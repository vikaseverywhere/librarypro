#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

function runGit(args) {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    if (result.status !== 0) {
        const err = result.stderr?.trim() || `git ${args.join(' ')} failed`;
        throw new Error(err);
    }
    return (result.stdout || '').trim();
}

const blockedFilePatterns = [
    /^src\/environments\/environment\.ts$/i,
    /^src\/environments\/environment\.prod\.ts$/i,
    /^\.env(\..+)?$/i
];

const secretPatterns = [
    { name: 'Google API key', regex: /AIza[0-9A-Za-z\-_]{35}/ },
    { name: 'Firebase private key block', regex: /-----BEGIN PRIVATE KEY-----/ },
    { name: 'Razorpay live key', regex: /rzp_live_[0-9A-Za-z]{8,}/ },
    { name: 'Stripe live secret', regex: /sk_live_[0-9A-Za-z]{10,}/ },
    { name: 'AWS access key id', regex: /AKIA[0-9A-Z]{16}/ },
    { name: 'Generic secret assignment', regex: /(api[_-]?key|secret|token|private[_-]?key)\s*[:=]\s*['"][^'"\n]{12,}['"]/i }
];

const allowLinePatterns = [
    /YOUR_/i,
    /PLACEHOLDER/i,
    /EXAMPLE/i,
    /DUMMY/i,
    /TEST/i
];

const ignoredScanFiles = new Set([
    'scripts/scan-staged-secrets.js'
]);

function isAllowedLine(line) {
    return allowLinePatterns.some((pattern) => pattern.test(line));
}

function getStagedFiles() {
    const output = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
    if (!output) {
        return [];
    }
    return output
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function getStagedFileContent(file) {
    const result = spawnSync('git', ['show', `:${file}`], { encoding: 'utf8' });
    if (result.status !== 0) {
        return '';
    }
    return result.stdout || '';
}

function scanFileForSecrets(file, content) {
    if (ignoredScanFiles.has(file)) {
        return [];
    }

    const issues = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (!line || isAllowedLine(line)) {
            continue;
        }

        for (const pattern of secretPatterns) {
            if (pattern.regex.test(line)) {
                issues.push({
                    file,
                    line: i + 1,
                    reason: pattern.name,
                    text: line.length > 160 ? `${line.slice(0, 157)}...` : line
                });
                break;
            }
        }
    }

    return issues;
}

function main() {
    let stagedFiles;
    try {
        stagedFiles = getStagedFiles();
    } catch (error) {
        console.error('Could not inspect staged files. Commit blocked.');
        console.error(error.message);
        process.exit(1);
    }

    if (stagedFiles.length === 0) {
        process.exit(0);
    }

    const blockedFiles = stagedFiles.filter((file) => blockedFilePatterns.some((pattern) => pattern.test(file)));
    const issues = [];

    for (const file of stagedFiles) {
        const content = getStagedFileContent(file);
        if (!content) {
            continue;
        }
        issues.push(...scanFileForSecrets(file, content));
    }

    if (blockedFiles.length === 0 && issues.length === 0) {
        console.log('Secret scan passed.');
        process.exit(0);
    }

    console.error('\nCommit blocked by secret guard.\n');

    if (blockedFiles.length > 0) {
        console.error('Protected files are staged (never commit real environment files):');
        for (const file of blockedFiles) {
            console.error(`  - ${file}`);
        }
        console.error('');
    }

    if (issues.length > 0) {
        console.error('Potential secrets detected:');
        for (const issue of issues) {
            console.error(`  - ${issue.file}:${issue.line} (${issue.reason})`);
        }
        console.error('');
    }

    console.error('How to fix:');
    console.error('  1) Remove sensitive values from staged files.');
    console.error('  2) Keep placeholders in tracked files.');
    console.error('  3) Use src/environments/environment.template.ts as the committed reference.');
    console.error('  4) Re-stage and commit again.\n');

    process.exit(1);
}

main();
