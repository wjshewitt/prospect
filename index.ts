import "dotenv/config";
import { Sandbox } from "@e2b/code-interpreter";

async function main() {
    const sbx = await Sandbox.create(); // By default the sandbox is alive for 5 minutes
    const execution = await sbx.runCode('print("hello world")'); // Execute Python inside the sandbox
    console.log(execution.logs);

    const files = await sbx.files.list("/");
    console.log(files);
}

main().catch(console.error);
