#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import {
  createReceipt,
  diffPolicies,
  evaluateAction,
  serializeReceipt,
  verifyReceipt,
} from "@batasaksi/core";
import type {
  ActionEnvelope,
  ActionPolicy,
  ActionReceipt,
  Approval,
  Decision,
} from "@batasaksi/core";
import { formatDiff, formatEvaluation, formatVerification } from "./format.js";

const help = `BatasAksi — preflight controls for AI agent actions

Usage:
  batasaksi simulate <action.json> <policy.json> [--json] [--fail-on review|deny]
  batasaksi receipt <action.json> <policy.json> --output <receipt.json>
                     [--approved-by "Name:role"] [--previous <receipt.json>]
  batasaksi verify <receipt.json> [--action <action.json>] [--policy <policy.json>]
                    [--previous <receipt.json>] [--json]
  batasaksi diff-policy <old.json> <new.json> [--json]

All evaluation is local and deterministic. No action is executed.`;

interface ParsedArgs {
  command: string | undefined;
  positionals: string[];
  flags: Map<string, string[]>;
}

function parseArgs(args: string[]): ParsedArgs {
  const [command, ...rest] = args;
  const positionals: string[] = [];
  const flags = new Map<string, string[]>();

  for (let index = 0; index < rest.length; index += 1) {
    const entry = rest[index]!;
    if (!entry.startsWith("--")) {
      positionals.push(entry);
      continue;
    }
    const key = entry.slice(2);
    const next = rest[index + 1];
    const value = next && !next.startsWith("--") ? next : "true";
    flags.set(key, [...(flags.get(key) ?? []), value]);
    if (value !== "true") {
      index += 1;
    }
  }

  return { command, positionals, flags };
}

async function readJson<T>(path: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read ${path}: ${message}`);
  }
}

function requiredPositionals(parsed: ParsedArgs, count: number): string[] {
  if (parsed.positionals.length < count) {
    throw new Error(`Expected ${count} file argument(s).\n\n${help}`);
  }
  return parsed.positionals;
}

function output(value: unknown, json: boolean, formatted: string): void {
  process.stdout.write(json ? `${JSON.stringify(value, null, 2)}\n` : `${formatted}\n`);
}

async function simulate(parsed: ParsedArgs): Promise<number> {
  const [actionPath, policyPath] = requiredPositionals(parsed, 2) as [string, string];
  const [action, policy] = await Promise.all([
    readJson<ActionEnvelope>(actionPath),
    readJson<ActionPolicy>(policyPath),
  ]);
  const result = evaluateAction(action, policy);
  output(result, parsed.flags.has("json"), formatEvaluation(result));

  const failOn = parsed.flags.get("fail-on")?.at(-1) as Decision | undefined;
  if (failOn && !["review", "deny"].includes(failOn)) {
    throw new Error("--fail-on must be review or deny.");
  }
  if (failOn === "review" && result.decision !== "allow") return 2;
  if (failOn === "deny" && result.decision === "deny") return 2;
  return 0;
}

function parseApprovals(values: string[]): Approval[] {
  return values.map((entry) => {
    const separator = entry.lastIndexOf(":");
    if (separator <= 0 || separator === entry.length - 1) {
      throw new Error('--approved-by must use "Name:role".');
    }
    return {
      approver: entry.slice(0, separator),
      role: entry.slice(separator + 1),
      approvedAt: new Date().toISOString(),
    };
  });
}

async function receipt(parsed: ParsedArgs): Promise<number> {
  const [actionPath, policyPath] = requiredPositionals(parsed, 2) as [string, string];
  const outputPath = parsed.flags.get("output")?.at(-1);
  if (!outputPath || outputPath === "true") {
    throw new Error("receipt requires --output <receipt.json>.");
  }
  const previousPath = parsed.flags.get("previous")?.at(-1);
  const [action, policy, previousReceipt] = await Promise.all([
    readJson<ActionEnvelope>(actionPath),
    readJson<ActionPolicy>(policyPath),
    previousPath && previousPath !== "true"
      ? readJson<ActionReceipt>(previousPath)
      : Promise.resolve(undefined),
  ]);
  const generated = await createReceipt({
    action,
    policy,
    approvals: parseApprovals(parsed.flags.get("approved-by") ?? []),
    ...(previousReceipt ? { previousReceipt } : {}),
  });
  await writeFile(outputPath, serializeReceipt(generated), "utf8");
  process.stdout.write(`✓ Receipt written to ${outputPath}\n${generated.receiptHash}\n`);
  return 0;
}

async function verify(parsed: ParsedArgs): Promise<number> {
  const [receiptPath] = requiredPositionals(parsed, 1) as [string];
  const actionPath = parsed.flags.get("action")?.at(-1);
  const policyPath = parsed.flags.get("policy")?.at(-1);
  const previousPath = parsed.flags.get("previous")?.at(-1);
  const [receiptValue, action, policy, previousReceipt] = await Promise.all([
    readJson<ActionReceipt>(receiptPath),
    actionPath && actionPath !== "true"
      ? readJson<ActionEnvelope>(actionPath)
      : Promise.resolve(undefined),
    policyPath && policyPath !== "true"
      ? readJson<ActionPolicy>(policyPath)
      : Promise.resolve(undefined),
    previousPath && previousPath !== "true"
      ? readJson<ActionReceipt>(previousPath)
      : Promise.resolve(undefined),
  ]);
  const result = await verifyReceipt({
    receipt: receiptValue,
    ...(action ? { action } : {}),
    ...(policy ? { policy } : {}),
    ...(previousReceipt ? { previousReceipt } : {}),
  });
  output(result, parsed.flags.has("json"), formatVerification(result));
  return result.valid ? 0 : 3;
}

async function policyDiff(parsed: ParsedArgs): Promise<number> {
  const [oldPath, newPath] = requiredPositionals(parsed, 2) as [string, string];
  const [oldPolicy, newPolicy] = await Promise.all([
    readJson<ActionPolicy>(oldPath),
    readJson<ActionPolicy>(newPath),
  ]);
  const result = diffPolicies(oldPolicy, newPolicy);
  output(result, parsed.flags.has("json"), formatDiff(result));
  return result.weakenedControls.length > 0 ? 4 : 0;
}

export async function run(args = process.argv.slice(2)): Promise<number> {
  const parsed = parseArgs(args);
  if (!parsed.command || parsed.command === "help" || parsed.flags.has("help")) {
    process.stdout.write(`${help}\n`);
    return 0;
  }
  if (parsed.command === "simulate") return simulate(parsed);
  if (parsed.command === "receipt") return receipt(parsed);
  if (parsed.command === "verify") return verify(parsed);
  if (parsed.command === "diff-policy") return policyDiff(parsed);
  throw new Error(`Unknown command: ${parsed.command}\n\n${help}`);
}

const isEntrypoint = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isEntrypoint) {
  run()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
