"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInWolfram = exports.printResults = exports.activate = exports.wolframKernelClient = exports.wolframClient = void 0;
const vscode = require("vscode");
const path = require("path");
const net = require("net");
const fp = require('find-free-port');
const psTree = require('ps-tree');
const cp = require("child_process");
const vscode_languageclient_1 = require("vscode-languageclient");
const notebook_1 = require("./notebook");
const notebookController_1 = require("./notebookController");
const fs = require('fs');
let client;
let wolframStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
wolframStatusBar.command = "wolfram.restart";
wolframStatusBar.text = "$(repo-sync~spin) Loading Wolfram...";
wolframStatusBar.show();
let kernelStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
kernelStatusBar.command = "wolfram.launchKernel";
kernelStatusBar.text = "$(lightbulb)";
kernelStatusBar.color = "foreground";
kernelStatusBar.show();
let PORT;
let kernelPORT;
let outputChannel = vscode.window.createOutputChannel('wolf-lsp');
let lspPath = '';
let kernelPath = '';
let theContext;
let notebook;
let serializer;
let controller;
vscode.workspace.onDidChangeTextDocument(didChangeTextDocument);
vscode.workspace.onDidOpenTextDocument(didOpenTextDocument);
vscode.workspace.onDidSaveTextDocument(didSaveTextDocument);
vscode.window.onDidChangeWindowState(didChangeWindowState);
vscode.commands.registerCommand('wolfram.runInWolfram', runInWolfram);
vscode.commands.registerCommand('wolfram.runExpression', runExpression);
vscode.commands.registerCommand('wolfram.runToLine', runToLine);
vscode.commands.registerCommand('wolfram.printInWolfram', printInWolfram);
vscode.commands.registerCommand('wolfram.wolframTerminal', startWolframTerminal);
vscode.commands.registerCommand('wolfram.runInTerminal', runInTerminal);
vscode.commands.registerCommand('wolfram.clearDecorations', clearDecorations);
vscode.commands.registerCommand('wolfram.showOutput', showOutput);
vscode.commands.registerCommand('wolfram.help', help);
vscode.commands.registerCommand('wolfram.restart', restart);
vscode.commands.registerCommand('wolfram.restartKernel', restartKernel);
vscode.commands.registerCommand('wolfram.abort', abort);
vscode.commands.registerCommand('wolfram.textToSection', textToSection);
vscode.commands.registerCommand('wolfram.textFromSection', textFromSection);
let theDisposible;
let theKernelDisposible;
function randomPort() {
    return Math.round(Math.random() * (100) + 8888);
}
function rejectDelay(reason) {
    let t = 500;
    return new Promise(function (resolve, reject) {
        setTimeout(reject.bind(null, reason), t);
    });
}
// function retry(fn:any, retries=5, err=null) {
//     if (!retries) {
//         return Promise.reject(err);
//     }
//     return fn().catch((err:any) => {
//         return retry(fn, (retries - 1), err);
//     });
// }
function check_pulse(wolframClient, wolframKernelClient) {
    if (wolframClient !== undefined && wolframKernelClient !== undefined) {
        console.log(wolframClient.needsStart());
        console.log(wolframKernelClient.needsStart());
        if (!wolframClient.isConnectionActive() || !wolframKernelClient.isConnectionActive()) {
            restart();
        }
    }
}
function activate(context) {
    theContext = context;
    lspPath = context.asAbsolutePath(path.join('wolfram', 'wolfram-lsp.wl'));
    kernelPath = context.asAbsolutePath(path.join('wolfram', 'wolfram-kernel.wl'));
    serializer = new notebook_1.WolframNotebookSerializer();
    controller = new notebookController_1.WolframController();
    connectKernel(outputChannel, context);
    context.subscriptions.push(vscode.workspace.registerNotebookSerializer('wolfram-notebook', serializer));
    context.subscriptions.push(controller);
}
exports.activate = activate;
function connectKernel(outputChannel, context) {
    fp(randomPort()).then((freep) => {
        PORT = freep[0];
        if (PORT != undefined) {
            console.log("Wolfram Port: " + PORT.toString());
            loadwolfram(() => {
                // await new Promise(resolve => setTimeout(resolve, 5000));
                console.log("Wolfram loaded. Connecting...");
                loadWolframServer(outputChannel, context, (theDisposible) => {
                    if (theDisposible != null) {
                        console.log("Connected");
                        context.subscriptions.push(theDisposible);
                        console.log("Connecting to Kernel");
                        //retry(function(){return connectKernelClient(outputChannel, context)});
                        connectKernelClient(outputChannel, context);
                    }
                    else {
                        console.log("Failed to connect");
                        stopWolfram(exports.wolframClient, wolfram);
                    }
                    // wolframNotebookProvider.setWolframClient(wolframClient);
                });
            });
        }
        else {
            console.log("Failed to find free port. Retrying");
        }
    });
}
function connectKernelClient(outputChannel, context) {
    fp(randomPort()).then((freep) => {
        kernelPORT = freep[0];
        if (kernelPORT == undefined) {
            console.log("Failed to find free port. Retrying");
        }
        console.log("Kernel Port: " + kernelPORT.toString());
        loadwolframKernel(() => {
            // await new Promise(resolve => setTimeout(resolve, 5000));
            loadWolframKernelClient(outputChannel, context, (theKernelDisposible) => {
                if (theKernelDisposible != null) {
                    console.log("Connected to Kernel");
                    context.subscriptions.push(theKernelDisposible);
                    vscode.window.showInformationMessage("Wolfram is ready.");
                }
                else {
                    console.log("Failed to connect to Kernel");
                    stopWolfram(exports.wolframKernelClient, wolframKernel);
                }
                // wolframNotebookProvider.setWolframKernelClient(wolframKernelClient);
            });
        });
    });
}
let wolframKernel;
let loadwolframKernel = function (callback) {
    var _a, _b;
    if (process.env.VSCODE_DEBUG_MODE === "true") {
        PORT = 6589;
    }
    else {
        try {
            if (process.platform === "win32") {
                wolframKernel = cp.spawn('cmd.exe', ['/c', 'wolframscript.exe', '-file', kernelPath, kernelPORT.toString(), kernelPath], { detached: false });
            }
            else {
                wolframKernel = cp.spawn('wolframscript', ['-file', kernelPath, kernelPORT.toString(), kernelPath], { detached: true });
            }
            if (wolframKernel.pid != undefined) {
                console.log("Launching wolframkernel: " + wolframKernel.pid.toString());
            }
            else {
                console.log("Launching wolframkernel: pid unknown");
            }
            (_a = wolframKernel.stdout) === null || _a === void 0 ? void 0 : _a.on('data', (data) => {
                console.log("WKernel: " + data.toString());
                if (data.toString().includes("Kernel Ready")) {
                    console.log("Wolfram kernel loaded. Connecting...");
                    callback();
                }
            });
            wolframKernel.on('SIGPIPE', (data) => {
                console.log("SIGPIPE");
            });
            (_b = wolframKernel.stdout) === null || _b === void 0 ? void 0 : _b.on('error', (data) => {
                console.log("STDOUT Error" + data.toString());
            });
        }
        catch (error) {
            console.log(error);
            vscode.window.showErrorMessage("Wolframscript failed to load kernel.");
        }
    }
};
let wolfram;
let loadwolfram = function (callback) {
    var _a, _b;
    if (process.env.VSCODE_DEBUG_MODE === "true") {
        PORT = 6589;
    }
    else {
        try {
            if (process.platform === "win32") {
                wolfram = cp.spawn('cmd.exe', ['/c', 'wolframscript.exe', '-file', lspPath, PORT.toString(), lspPath], { detached: false });
            }
            else {
                wolfram = cp.spawn('wolframscript', ['-file', lspPath, PORT.toString(), lspPath], { detached: true });
            }
            if (wolfram.pid != undefined) {
                console.log("Launching wolframscript: " + wolfram.pid.toString());
            }
            else {
                console.log("Launching wolframscript: pid unknown");
            }
            wolfram.on('SIGPIPE', (data) => {
                console.log("SIGPIPE");
            });
            (_a = wolfram.stdout) === null || _a === void 0 ? void 0 : _a.on('error', (data) => {
                console.log("STDOUT Error" + data.toString());
            });
            (_b = wolfram.stdout) === null || _b === void 0 ? void 0 : _b.once('data', (data) => {
                var _a;
                (_a = wolfram.stdout) === null || _a === void 0 ? void 0 : _a.on('data', (data) => {
                    console.log("WLSP: " + data.toString());
                });
                callback();
            });
        }
        catch (error) {
            console.log(error);
            vscode.window.showErrorMessage("Wolframscript failed to load.");
        }
    }
};
function loadWolframKernelClient(outputChannel, context, callback) {
    let serverOptions = function () {
        return new Promise((resolve, reject) => {
            let client = new net.Socket();
            client.setTimeout(5000);
            client.on('timeout', () => {
                // client.end();
                client.connect(kernelPORT, "127.0.0.1", () => {
                    // client.setKeepAlive(true,20000);
                    // resolve({
                    //     reader: client,
                    //     writer: client
                    // });
                });
            });
            client.connect(kernelPORT, "127.0.0.1", () => {
                // client.setKeepAlive(true,20000);
                resolve({
                    reader: client,
                    writer: client
                });
            });
        });
    };
    let clientOptions = {
        documentSelector: [
            "wolfram"
        ],
        diagnosticCollectionName: 'wolfram-lsp',
        outputChannel: outputChannel
    };
    exports.wolframKernelClient = new vscode_languageclient_1.LanguageClient('wolfram', 'Wolfram Language Server Kernel', serverOptions, clientOptions);
    exports.wolframKernelClient.onReady().then(() => {
        exports.wolframKernelClient.onNotification("onRunInWolfram", onRunInWolfram);
        exports.wolframKernelClient.onNotification("wolframBusy", wolframBusy);
        exports.wolframKernelClient.onNotification("updateDecorations", updateDecorations);
        exports.wolframKernelClient.onNotification("updateVarTable", updateVarTable);
        exports.wolframKernelClient.onNotification("moveCursor", moveCursor);
        console.log("Sending kernel disposible");
        callback(disposible);
    });
    console.log("Starting kernel disposible");
    let disposible = exports.wolframKernelClient.start();
    // setTimeout(() => {setInterval(check_pulse, 1000, wolframClient, wolframKernelClient)}, 3000)
}
function loadWolframServer(outputChannel, context, callback) {
    // let serverOptions = {
    //     run: { module: serverModule, transport: TransportKind.ipc },
    //     debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    // };
    //logtime("start client");
    let serverOptions = function () {
        return new Promise((resolve, reject) => {
            let client = new net.Socket();
            client.on("data", (data) => {
                //console.log("LSP Client: " + data.toString())
            });
            client.setTimeout(5000);
            client.on('timeout', () => {
                // client.destroy();
                client.end();
                client.connect(PORT, "127.0.0.1", () => {
                    // client.setKeepAlive(true,20000);
                    // resolve({
                    //     reader: client,
                    //     writer: client
                    // });
                });
            });
            //setTimeout(() =>{
            client.connect(PORT, "127.0.0.1", () => {
                // client.setKeepAlive(true, 20000)
                resolve({
                    reader: client,
                    writer: client
                });
            });
            // client.on("error", (e) => { 
            //     outputChannel.appendLine("Error:" + e.message);
            //     // loadWolframServer(outputChannel, context);
            //     setTimeout(() =>  loadWolframServer(outputChannel, context), 1000);
            //     client.destroy();
            // });
            // client.on("timeout", () => { outputChannel.appendLine("Timeout"); reject();});
            //logtime("connected");
            //}, 10000);
        });
    };
    let clientOptions = {
        documentSelector: [
            "wolfram"
        ],
        diagnosticCollectionName: 'wolfram-lsp',
        outputChannel: outputChannel
    };
    exports.wolframClient = new vscode_languageclient_1.LanguageClient('wolfram', 'Wolfram Language Server', serverOptions, clientOptions);
    exports.wolframClient.onReady().then(() => {
        //wolframClient.sendRequest("DocumentSymbolRequest");
        exports.wolframClient.onNotification("wolframVersion", wolframVersion);
        // wolframClient.onNotification("moveCursor", moveCursor);
        // wolframClient.onNotification("wolframResult", wolframResult);
        callback(disposible);
    });
    let disposible = exports.wolframClient.start();
}
let wolframVersionText = "wolfram v.?";
function wolframVersion(data) {
    wolframVersionText = data["output"];
    wolframStatusBar.text = wolframVersionText;
    wolframStatusBar.show();
}
// function wolframResult(result:any) {
//     let e: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
//     let outputPosition = new vscode.Position(result["position"]["line"], result["position"]["character"]);
//     printResults.push(result["output"]);
//     if (printResults.length > 20) {
//         printResults.shift();
//     }
//     // showOutput(printResults);
//     if(typeof(e) !== "undefined") {
//         e.edit(editBuilder => {
//             // if (result["output"].indexOf("<img") >= 0 ){
//             //     printResults.push(result["output"]);
//             //     showOutput(printResults);
//             // } 
//             if(result["print"]){
//                 editBuilder.insert(outputPosition, "(* " + result["output"] + " *)\n");
//             }
//         });
//     }
//     wolframStatusBar.text = wolframVersionText;
// }
function didOpenTextDocument(document) {
    if (document.languageId !== 'wolfram' || (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')) {
        return;
    }
    if (document.languageId === "wolfram") {
        if (exports.wolframClient !== undefined) {
            exports.wolframClient.onReady().then(ready => {
                exports.wolframClient.sendRequest("DocumentSymbolRequest");
            });
        }
    }
    return;
}
function didChangeTextDocument(event) {
    // didOpenTextDocument(event.document);
    // remove old decorations
    let editor = vscode.window.activeTextEditor;
    let decorations = [];
    if (editor == null) {
        return;
    }
    else {
        let position = editor === null || editor === void 0 ? void 0 : editor.selection.active;
        let uri = editor.document.uri.toString();
        if ((workspaceDecorations == undefined) || (workspaceDecorations == null)) {
            workspaceDecorations = {};
        }
        if (workspaceDecorations[uri] !== undefined) {
            Object.keys(workspaceDecorations[uri]).forEach((line) => {
                if (parseInt(line, 10) < position.line) {
                    decorations.push(workspaceDecorations[uri][line]);
                }
                else {
                    delete workspaceDecorations[uri][line];
                }
            });
        }
        editor.setDecorations(variableDecorationType, decorations);
    }
    return;
}
function didSaveTextDocument(event) {
    didOpenTextDocument(event);
    return;
}
function moveCursor(params) {
    let e = vscode.window.activeTextEditor;
    let outputPosition = new vscode.Position(params["position"]["line"], params["position"]["character"]);
    if (e) {
        e.selection = new vscode.Selection(outputPosition, outputPosition);
        e.revealRange(new vscode.Range(outputPosition, outputPosition), vscode.TextEditorRevealType.Default);
        let decorationLine = e.document.lineAt(outputPosition.line - 1);
        let start = new vscode.Position(decorationLine.lineNumber, decorationLine.range.end.character);
        let end = new vscode.Position(decorationLine.lineNumber, decorationLine.range.end.character);
        let range = new vscode.Range(start, end);
        let d = {
            "range": range,
            "renderOptions": {
                "after": {
                    "contentText": "...",
                    "color": "foreground",
                    "margin": "20px"
                }
            }
        };
        updateDecorations([d]);
    }
}
function restartKernel() {
    kernelStatusBar.color = "yellow";
    exports.wolframKernelClient.stop();
    let isWin = /^win/.test(process.platform);
    if (isWin) {
        let cp = require('child_process');
        cp.exec('taskkill /PID ' + wolfram.pid + ' /T /F', function (error, stdout, stderr) {
        });
        cp.exec('taskkill /PID ' + wolframKernel.pid + ' /T /F', function (error, stdout, stderr) {
        });
    }
    else {
        kill(wolframKernel.pid);
    }
    // //let context = myContext;
    // wolframStatusBar.text = "$(repo-sync~spin) Restarting Wolfram...";
    // wolframStatusBar.show();
    vscode.window.showInformationMessage("Wolfram Kernel is restarting.");
    connectKernelClient(outputChannel, context);
    // context.subscriptions.forEach((sub:any) => {
    //     try {
    //         sub.dispose();
    //     } catch (error) {
    //         outputChannel.appendLine("subs: " + error);
    //     }
    // });
    // context.subscriptions.push(loadWolframServer(outputChannel, context));
    // fp(randomPort()).then((freep:any) => { 
    //     kernelPORT = freep[0];
    //     outputChannel.appendLine("Port: " + kernelPORT.toString());
    //     loadwolframKernel().then(async (success:any) => {
    //         await new Promise(resolve => setTimeout(resolve, 10000));
    //         theKernelDisposible = loadWolframKernelClient(outputChannel, theContext)
    //         theContext.subscriptions.push(theKernelDisposible);
    //         // wolframNotebookProvider.setWolframClient(wolframClient);
    //     });
    // }); 
}
exports.printResults = [];
function runInWolfram(print = false) {
    let e = vscode.window.activeTextEditor;
    let sel = e.selection;
    let outputPosition = new vscode.Position(sel.active.line + 1, 0);
    if ((e === null || e === void 0 ? void 0 : e.document.lineCount) == outputPosition.line) {
        e === null || e === void 0 ? void 0 : e.edit(editBuilder => {
            editBuilder.insert(outputPosition, "\n");
        });
    }
    if ((e === null || e === void 0 ? void 0 : e.document.uri.scheme) === 'vscode-notebook-cell') {
        e.selection = new vscode.Selection(0, 0, 1, 1);
        try {
            exports.wolframKernelClient.sendNotification("runInWolfram", { range: sel, textDocument: e.document, print: false });
        }
        catch (err) {
            console.log(err);
        }
    }
    else if ((e === null || e === void 0 ? void 0 : e.document.uri.scheme) === 'file' || (e === null || e === void 0 ? void 0 : e.document.uri.scheme) === 'untitled') {
        e.selection = new vscode.Selection(outputPosition, outputPosition);
        e.revealRange(new vscode.Range(outputPosition, outputPosition), vscode.TextEditorRevealType.Default);
        // wolframKernelClient.sendNotification("moveCursor", {range:sel, textDocument:e.document});
        if (exports.wolframKernelClient.isConnectionActive()) {
            exports.wolframKernelClient.sendNotification("runInWolfram", { range: sel, textDocument: e.document, print: print });
        }
        else {
            console.log("Kernel is not ready. Please try again...");
            stopWolfram(exports.wolframKernelClient, wolframKernel);
            connectKernelClient(outputChannel, context);
        }
    }
}
exports.runInWolfram = runInWolfram;
function onRunInWolfram(result) {
    let editors = vscode.window.visibleTextEditors;
    let e = editors.filter((e) => { return e.document.uri.path === result["document"]["path"]; })[0];
    if (e.document.uri.scheme == 'vscode-notebook-cell') {
        vscode.notebooks;
    }
    else {
        updateResults(e, result, result["print"]);
    }
}
let variableTable = {};
function updateVarTable(vars) {
    for (let index = 0; index < vars["values"].length; index++) {
        variableTable[vars["values"][index][0]] = vars["values"][index][1].slice(0, 200) + "...";
    }
    updateOutputPanel();
}
let maxPrintResults = 20;
function updateResults(e, result, print) {
    if (exports.printResults.length > maxPrintResults) {
        exports.printResults.shift();
    }
    if (typeof (e) !== "undefined") {
        e.edit(editBuilder => {
            exports.printResults.push(result["output"].toString());
            showOutput();
            if (print) {
                let sel = e.selection;
                let outputPosition = new vscode.Position(sel.active.line + 1, 0);
                editBuilder.insert(outputPosition, "\t" + result["result"] + "\n");
            }
        });
    }
    ;
    updateOutputPanel();
    wolframStatusBar.text = wolframVersionText;
}
function runCell() {
    let e = vscode.window.activeTextEditor;
    // let n: vscode.NotebookDocument| undefined = e?.document;
    // let currentCell:vscode.NotebookCell;
    // if (n?.cells) {
    //     for (let index = 0; index < n.cells.length; index++) {
    //         if (n.cells[index].document.getText() === e?.document.getText()) {
    //             currentCell = n.cells[index]
    //             wolframNotebookProvider.executeCell(e, currentCell)
    //             break
    //         }
    //     }
    // }
}
function runExpression(expression, line, end) {
    let e = (vscode.window.activeTextEditor == null) ? vscode.window.visibleTextEditors[0] : vscode.window.activeTextEditor;
    exports.wolframKernelClient.sendNotification("runExpression", { print: false, expression: expression, textDocument: e === null || e === void 0 ? void 0 : e.document, line: line, end: end });
}
function printInWolfram() {
    let print = true;
    runInWolfram(print);
}
function textToSection() {
    let e = vscode.window.activeTextEditor;
    let lines;
    let newlines = "";
    if (e) {
        let sel = e.selection;
        lines = e === null || e === void 0 ? void 0 : e.document.getText(new vscode.Range(sel.start, sel.end)).split('\n');
        lines.forEach(l => {
            newlines += "(*" + l + "*)\n";
        });
        e.edit(editbuilder => {
            editbuilder.replace(sel, newlines.trimRight());
        });
    }
}
function textFromSection() {
    let e = vscode.window.activeTextEditor;
    let lines;
    let newlines = "";
    if (e) {
        let sel = e.selection;
        lines = e === null || e === void 0 ? void 0 : e.document.getText(new vscode.Range(sel.start, sel.end)).split('\n');
        lines.forEach(l => {
            newlines += l.replace(/^\(\*/, "").replace(/\*\)$/, "") + "\n";
        });
        e.edit(editbuilder => {
            editbuilder.replace(sel, newlines.trimRight());
        });
    }
}
function abort() {
    exports.wolframClient.sendNotification("abort");
    wolframStatusBar.text = wolframVersionText;
}
function stopWolfram(client, client_process) {
    client.stop();
    let isWin = /^win/.test(process.platform);
    if (isWin) {
        let cp = require('child_process');
        cp.exec('taskkill /PID ' + client_process.pid + ' /T /F', function (error, stdout, stderr) {
        });
    }
    else {
        kill(client.pid);
    }
}
function restart() {
    console.log("Restarting");
    wolframStatusBar.text = "$(repo-sync~spin) Loading Wolfram...";
    wolframStatusBar.show();
    vscode.window.showInformationMessage("Wolfram is restarting.");
    stopWolfram(exports.wolframClient, wolfram);
    stopWolfram(exports.wolframKernelClient, wolframKernel);
    wolframStatusBar.text = "Wolfram v.?";
    wolframStatusBar.show();
    // retry(function(){return connectKernel(outputChannel, theContext)});
    connectKernel(outputChannel, theContext);
}
function restartWolfram() {
    // try {
    //     kill(wolfram.pid);
    // } catch {
    //     outputChannel.appendLine("Failed to stop wolfram: " + wolfram.pid.toString());
    // }
    console.log("Restarting");
    wolframStatusBar.text = "$(repo-sync~spin) Loading Wolfram...";
    wolframStatusBar.show();
    vscode.window.showInformationMessage("Wolfram is restarting.");
    // stopWolfram();
    // wolframClient.stop();
    // wolframKernelClient.stop();
    // let isWin = /^win/.test(process.platform);
    // if(isWin) {
    //     let cp = require('child_process');
    //     cp.exec('taskkill /PID ' + wolfram.pid + ' /T /F', function (error:any, stdout:any, stderr:any) {
    //     }); 
    //     cp.exec('taskkill /PID ' + wolframKernel.pid + ' /T /F', function (error:any, stdout:any, stderr:any) {
    //     }); 
    // } else {        
    //     kill(wolfram.pid);
    //     kill(wolframKernel.pid);
    // }
    //let context = myContext;
    // context.subscriptions.forEach((sub:any) => {
    //     try {
    //         sub.dispose();
    //     } catch (error) {
    //         outputChannel.appendLine("subs: " + error);
    //     }
    // });
    // context.subscriptions.push(loadWolframServer(outputChannel, context));
    theContext.subscriptions.length = 0;
    fp(randomPort()).then((freep) => {
        kernelPORT = freep[0];
        console.log("Kernel Port: " + kernelPORT.toString());
        loadwolframKernel((success) => {
            // await new Promise(resolve => setTimeout(resolve, 10000));
            theKernelDisposible.dispose();
            loadWolframKernelClient(outputChannel, theContext, (success) => {
                theKernelDisposible = success;
            });
            theContext.subscriptions.push(theKernelDisposible);
            // wolframNotebookProvider.setWolframClient(wolframClient);
        });
    });
    fp(randomPort()).then((freep) => {
        PORT = freep[0];
        console.log("LSP Port: " + PORT.toString());
        loadwolfram(() => __awaiter(this, void 0, void 0, function* () {
            // await new Promise(resolve => setTimeout(resolve, 5000));
            // loadWolframServer(outputChannel, context)
            theDisposible.dispose();
            loadWolframServer(outputChannel, theContext, (success) => __awaiter(this, void 0, void 0, function* () {
                theDisposible = success;
                theContext.subscriptions.push(theDisposible);
                wolframStatusBar.text = wolframVersionText;
            }));
        }));
    });
}
let kill = function (pid) {
    let signal = 'SIGKILL';
    let callback = function () { };
    var killTree = true;
    if (killTree) {
        psTree(pid, function (err, children) {
            [pid].concat(children.map(function (p) {
                return p.PID;
            })).forEach(function (pid) {
                try {
                    process.kill(pid, signal);
                }
                catch (ex) {
                    console.log("Failed to kill: " + pid);
                }
            });
            callback();
        });
    }
    else {
        try {
            process.kill(pid, signal);
        }
        catch (ex) {
            console.log("Failed to kill wolfram process");
        }
        callback();
    }
};
function runToLine() {
    let e = vscode.window.activeTextEditor;
    let sel = e === null || e === void 0 ? void 0 : e.selection.active;
    let outputPosition = new vscode.Position(sel.line + 1, 0);
    let r = new vscode.Selection(0, 0, sel.line, sel.character);
    e.revealRange(r, vscode.TextEditorRevealType.Default);
    try {
        exports.wolframKernelClient.sendRequest("runInWolfram", { range: r, textDocument: e.document, print: false }).then((result) => {
            // cursor has not moved yet
            if (e.selection.active.line === outputPosition.line - 1 && e.selection.active.character === outputPosition.character) {
                outputPosition = new vscode.Position(result["position"]["line"], result["position"]["character"]);
                e.selection = new vscode.Selection(outputPosition, outputPosition);
                e.revealRange(new vscode.Range(outputPosition, outputPosition), vscode.TextEditorRevealType.Default);
            }
            updateResults(e, result, false);
        });
    }
    catch (_a) {
        console.log("Kernel is not ready. Restarting...");
        restart();
    }
}
function didChangeWindowState(state) {
    if (exports.wolframClient !== null || exports.wolframClient !== undefined) {
        if (state.focused === true) {
            exports.wolframClient.onReady().then(ready => {
                exports.wolframClient.sendNotification("windowFocused", true);
            });
        }
        else {
            exports.wolframClient.onReady().then(ready => {
                exports.wolframClient.sendNotification("windowFocused", false);
            });
        }
    }
}
let variableDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'none',
    light: {
        color: new vscode.ThemeColor("foreground")
    },
    dark: {
        color: new vscode.ThemeColor("foreground")
    }
});
let workspaceDecorations = {};
function clearDecorations() {
    let e = vscode.window.activeTextEditor;
    workspaceDecorations = {};
    e === null || e === void 0 ? void 0 : e.setDecorations(variableDecorationType, []);
}
function updateDecorations(decorations) {
    let editor = vscode.window.activeTextEditor;
    if ((editor === null || editor === void 0 ? void 0 : editor.document.uri.scheme) === 'file' || (editor === null || editor === void 0 ? void 0 : editor.document.uri.scheme) === 'untitled') {
        //editor.setDecorations(variableDecorationType, []);
        if (typeof (editor) === "undefined") {
            return;
        }
        let uri = editor.document.uri.toString();
        workspaceDecorations[uri] = {};
        decorations.forEach(d => {
            workspaceDecorations[uri][d.range.start.line] = d;
        });
        let editorDecorations = [];
        Object.keys(workspaceDecorations[uri]).forEach((d) => {
            editorDecorations.push(workspaceDecorations[uri][d]);
        });
        editor.setDecorations(variableDecorationType, editorDecorations);
    }
}
function wolframBusy(params) {
    if (params.busy === true) {
        kernelStatusBar.color = "red";
        wolframStatusBar.text = "$(repo-sync~spin) Wolfram Running";
        wolframStatusBar.show();
    }
    else {
        kernelStatusBar.color = "yellow";
        wolframStatusBar.text = wolframVersionText;
        wolframStatusBar.show();
    }
}
function startWolframTerminal() {
    let cmd;
    let args;
    if (process.platform === "win32") {
        cmd = 'cmd.exe';
        args = ['/c', 'wolframscript.exe'];
    }
    else {
        cmd = 'rlwrap wolframscript';
        args = [];
    }
    let activeWolframTerminal;
    activeWolframTerminal = vscode.window.createTerminal("wolfram terminal", cmd, args);
    activeWolframTerminal.show(true);
}
function runInTerminal() {
    var _a;
    if (!vscode.window.activeTerminal) {
        startWolframTerminal();
    }
    let e = vscode.window.activeTextEditor;
    let d = e.document;
    let sel = e.selections;
    (_a = vscode.window.activeTerminal) === null || _a === void 0 ? void 0 : _a.sendText(d.getText(new vscode.Range(e.selection.start, e === null || e === void 0 ? void 0 : e.selection.end)));
}
function help() {
    let e = vscode.window.activeTextEditor;
    let d = e.document;
    let sel = e.selections;
    let txt = "";
    let dataString = "";
    for (var x = 0; x < sel.length; x++) {
        txt = txt + d.getText(new vscode.Range(sel[x].start, sel[x].end));
    }
    let url = "https://reference.wolfram.com/language/ref/" + txt + ".html";
    // opn(url);
    let helpPanel = vscode.window.createWebviewPanel("wolframHelp", "Wolfram Help", 2, {
        enableScripts: true,
        retainContextWhenHidden: true
    });
    helpPanel.webview.html = `<!DOCTYPE html>
    <html lang="en">
    <head>
    
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' https://reference.wolfram.com 'unsafe-inline'">
    
    </head>
    <body>
        <iframe src="${url}" style="height:100vh; width:100%" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-modals"></iframe>
    </body>
    </html>
    `;
}
let outputPanel;
function showOutput() {
    var _a;
    let outputColumn = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.viewColumn;
    //let out = "<table id='outputs'>";
    if (outputPanel) {
        if (outputPanel.visible) {
        }
        else {
            if (outputColumn) {
                outputPanel.reveal(outputColumn + 1, true);
            }
            else {
                outputPanel.reveal(1, true);
            }
        }
    }
    else {
        if (outputColumn) {
            outputPanel = vscode.window.createWebviewPanel('WolframOutput', "Wolfram Output", { viewColumn: outputColumn + 1, preserveFocus: true }, {
                localResourceRoots: [vscode.Uri.file(path.join(theContext.extensionPath, 'wolfram'))],
                enableScripts: true,
                retainContextWhenHidden: true
            });
            outputPanel.webview.html = getOutputContent(outputPanel.webview);
            outputPanel.webview.onDidReceiveMessage(message => {
                runExpression(message.text, 0, 100);
                return;
            }, undefined, theContext.subscriptions);
            outputPanel.onDidDispose(() => {
                outputPanel = undefined;
            }, null);
            updateOutputPanel();
        }
    }
}
function updateOutputPanel() {
    let out = "";
    for (let i = 0; i < exports.printResults.length; i++) {
        // out += "<tr><td>" + i.toString() + ": </td><td>" + img3 + "</td></tr>";
        let data = "";
        try {
            data += fs.readFileSync(exports.printResults[i], 'utf8');
        }
        catch (e) {
            data += "Error reading result";
        }
        out += "<div id='result'>" +
            // printResults[i].replace(/(?:\r\n|\r|\n)/g, '<br><br>') + // .replace(/^\"/, '').replace(/\"$/, '')
            data +
            "</div>";
    }
    //out += "</table>";
    // if(typeof(outputPanel) === "undefined") {
    //     loadOutputPanel(myContext, 2);
    // }
    let vars = "<tr><th>Var</th><th>Value</th></tr>\n";
    let i = 0;
    Object.keys(variableTable).forEach(k => {
        if (i % 2 === 0) {
            vars += "<tr><td style='background:var(--vscode-editor-foreground) !important; color:var(--vscode-editor-background) !important;'>" + k + "</td><td style='background:var(--vscode-editor-foreground) !important; color:var(--vscode-editor-background) !important;'>" + variableTable[k] + "</td></tr>\n";
        }
        else {
            vars += "<tr><td>" + k + "</td><td>" + variableTable[k] + "</td></tr>\n";
        }
        i++;
    });
    outputPanel === null || outputPanel === void 0 ? void 0 : outputPanel.webview.postMessage({ text: out, vars: vars });
}
function getOutputContent(webview) {
    let timeNow = new Date().getTime();
    let result = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <style type="text/css">

            body{
                overflow:scroll;
                height:100%;
            }

            body.vscode-light {
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                font: var(--vscode-editor-font-family);
            }

            body.vscode-dark {
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                font: var(--vscode-editor-font-family);
            }

            body.vscode-high-contrast {
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                font: var(--vscode-editor-font-family);
            }

            #expression {
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                font: var(--vscode-editor-font-family);
                width: 100%;
            }

            #vars {
                height:38vh;
                position:relative;
                top:0;
                border-bottom: solid white 1px;
                overflow-y:scroll;
                width:93vw;
            }

            .outer {
                height:100vh;
                display:block;
                position:relative;
                top:0;
            }
            #scratch {
                position:fixed;
                width:95vw;
                bottom:0px;
                height: 8vh;
            }

            #scratch textarea {
                border-radius:2px;
                color: var(--vscode-editor-foreground);
                font: var(--vscode-editor-font-family);
            }

            #outputs {
                display: block;
                height: 50vh;
                position: fixed;
                top: 40vh;
                overflow-y: scroll;
            }

            #result {
                border-bottom: var(--vscode-editor-foreground) 2px solid;
                margin-top: 5px;
                padding: 5px;
                display: block;
                margin:0px;
                width:93vw;
                /* height:48vh; */
                overflow:scroll;
            }

            #result img{
                max-width: 100%;
                max-height: 90%;
                /* margin: 0; */
                /* min-height: 200px; */
                width: auto;
                margin-left: auto;
                margin-right: auto;
                display: block;
                height: auto;
            }


        </style>
        <meta charset="UTF-8">

        <!--
        Use a content security policy to only allow loading printResults from https or from our extension directory,
        and only allow scripts that have a specific nonce.
        
        <meta http-equiv="Content-Security-Policy" content="default-src 'none';">

        <meta http-equiv="Content-Security-Policy" content="default-src 'all'; img-src ${webview.cspSource} https: data:; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource};"/>
        -->
        <meta http-equiv="Content-Security-Policy" content="default-src *; img-src ${webview.cspSource} https: data:; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline';"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Wolfram Output</title>
        <script>
            const vscode = acquireVsCodeApi();
            function scrollToBottom() {
                // window.scrollTo(0,document.body.scrollHeight);

                var color = '';
                var fontFamily = '';
                var fontSize = '';
                var theme = '';
                var fontWeight = '';
                try {
                    computedStyle = window.getComputedStyle(document.body);
                    color = computedStyle.color + '';
                    backgroundColor = computedStyle.backgroundColor + '';
                    fontFamily = computedStyle.fontFamily;
                    fontSize = computedStyle.fontSize;
                    fontWeight = computedStyle.fontWeight;
                    theme = document.body.className;
                } catch(ex) { }
            }

        function run(input) {
            if(event.key === 'Enter') {
                if(event.shiftKey) {
                    vscode.postMessage({
                        text: input.value
                    });
                    input.value = ""
                }
            }
        }

        window.addEventListener('message', event => {
            const message = event.data;

            const outputDiv = document.getElementById('outputs');
            outputDiv.innerHTML = message.text;

            outputDiv.scrollTop = outputDiv.scrollHeight;

            const varT = document.getElementById('varTable');
            varT.innerHTML = message.vars;
        })
        </script>
    </head>
    <body onload="scrollToBottom()">
        <div class="outer">
            <div id="vars">
                <table id="varTable">
                    <th><td>Var</td><td>Value</td></th>
                    <tr><td></td><td>No values defined yet</td></tr>
                </table>
            </div>
            <div class="inner" id='outputs'>
            </div>
            <div id="scratch">
                <textarea id="expression" onkeydown="run(this)" rows="3" placeholder="Shift+Enter to run"></textarea>
            </div> 
        </div>
    </body>
    </html>`;
    return result;
}
//# sourceMappingURL=extension.js.map