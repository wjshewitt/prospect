'use client';

import { Sandbox } from '@e2b/code-interpreter';

let sandbox: Sandbox | null = null;

export async function getSandbox() {
    if (!sandbox) {
        sandbox = await Sandbox.create({
            apiKey: process.env.NEXT_PUBLIC_E2B_API_KEY,
            // Default timeout of 5 minutes
        });
    }
    return sandbox;
}

export async function runPythonCode(code: string) {
    const sbx = await getSandbox();
    return await sbx.runCode(code);
}

// Clean up sandbox when the page is closed
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', async () => {
        if (sandbox) {
            await sandbox.close();
            sandbox = null;
        }
    });
}
