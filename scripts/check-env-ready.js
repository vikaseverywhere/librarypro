#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const targets = [
    {
        label: 'development',
        file: path.join(root, 'src', 'environments', 'environment.ts')
    },
    {
        label: 'production',
        file: path.join(root, 'src', 'environments', 'environment.prod.ts')
    }
];

const requiredFirebaseKeys = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
];

const placeholderPatterns = [/YOUR_/i, /PLACEHOLDER/i, /CHANGE_ME/i, /REPLACE_ME/i];

function extractStringValue(content, key) {
    const regex = new RegExp(`${key}\\s*:\\s*["']([^"'\\n]+)["']`);
    const match = content.match(regex);
    return match ? match[1].trim() : '';
}

function isPlaceholder(value) {
    return !value || placeholderPatterns.some((p) => p.test(value));
}

function validateEnvFile(target) {
    if (!fs.existsSync(target.file)) {
        return [`Missing file: ${target.file}`];
    }

    const rawContent = fs.readFileSync(target.file, 'utf8');
    const content = rawContent
        .split(/\r?\n/)
        .filter((line) => !/^\s*\/\//.test(line))
        .join('\n');
    const issues = [];

    for (const key of requiredFirebaseKeys) {
        const value = extractStringValue(content, key);
        if (isPlaceholder(value)) {
            issues.push(`${target.label} env has invalid ${key}`);
        }
    }

    return issues;
}

function main() {
    const allIssues = targets.flatMap((target) => validateEnvFile(target));

    if (allIssues.length > 0) {
        console.error('\nEnvironment sanity check failed.\n');
        for (const issue of allIssues) {
            console.error(`- ${issue}`);
        }
        console.error('\nFix your local environment files and run again.\n');
        process.exit(1);
    }

    console.log('Environment sanity check passed.');
}

main();
