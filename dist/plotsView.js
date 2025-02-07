"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlotsViewProvider = void 0;
const vscode_1 = require("vscode");
const vscode = require("vscode");
const clients_1 = require("./clients");
const fs = require("fs");
class PlotsViewProvider {
    constructor(_extensionUri0, context) {
        this._extensionUri0 = _extensionUri0;
        this._text = "";
        this._allOutputs = new Map();
        this._out = [];
        this._fontSize = vscode.workspace.getConfiguration().get("wlsp.fontSize") || "var(--vscode-editor-font-size)";
        this._extensionUri = _extensionUri0;
        this._context = context;
    }
    resolveWebviewView(webviewView, context, _token) {
        var _a;
        this._view = webviewView;
        this._view.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode_1.Uri.joinPath(this._extensionUri, "media")]
        };
        this._text = "In: ...";
        this._view.webview.html = this.getOutputContent(this._view.webview, this._extensionUri);
        this._view.webview.onDidReceiveMessage((data) => {
            if (data.text === "restart") {
                (0, clients_1.restartKernel)();
            }
            if (data.text === "open") {
                // open new untitled document with content of data.output
                // console.log(data.output)
                // new document
                vscode.workspace.openTextDocument({ content: this._allOutputs.get(data.data) }).then((document) => {
                    vscode.window.showTextDocument(document);
                });
            }
            if (data.text === "paste") {
                // paste content of data.output
                // console.log(data.output)
                let editor = vscode.window.activeTextEditor;
                if (editor) {
                    let selection = editor.selection;
                    let position = new vscode.Position(selection.end.line + 1, 0);
                    editor.edit((editBuilder) => {
                        var _a;
                        editBuilder.insert(position, ((_a = this._allOutputs.get(data.data)) === null || _a === void 0 ? void 0 : _a.toString()) + "\n");
                    });
                }
            }
        }, undefined, (_a = this._context) === null || _a === void 0 ? void 0 : _a.subscriptions);
        this.updateView(this._out);
        // this._view?.webview.postMessage({text: []});
        this._view.show(true);
        // this._view.onDidChangeVisibility((e) => {
        //     if (this._view?.visible) {
        //         this._view?.webview.postMessage({text: []})
        //     }
        // })
        this._view.onDidDispose(() => {
            var _a;
            (_a = this._view) === null || _a === void 0 ? void 0 : _a.webview.postMessage({ command: "save", text: [], input: "", output: [] });
            this._view = undefined;
        }, null);
        // change the plotsView text css format when the configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            var _a;
            this._fontSize = vscode.workspace.getConfiguration().get("wlsp.fontSize") || "var(--vscode-editor-font-size)";
            (_a = this._view) === null || _a === void 0 ? void 0 : _a.webview.postMessage({ command: "fontSize", size: this._fontSize, text: [], input: "", output: [] });
        });
        return;
    }
    clearResults() {
        var _a;
        (_a = this._view) === null || _a === void 0 ? void 0 : _a.webview.postMessage({ command: "clear", text: [], input: "", output: [] });
    }
    updateView(out) {
        var _a;
        // this._text = out;
        this._out = out;
        let out2 = [];
        let index = 0;
        for (let i = 0; i < this._out.length; i++) {
            index = this._allOutputs.size;
            let img = fs.readFileSync(this._out[i][2]).toString();
            img = img.replace(`<div class="vertical"><span style="text-align:left" class="vertical-element">`, "");
            img = img.replace(`</span><span style="text-align:left" class="vertical-element"><br></span></div>`, "");
            let o = [this._out[i][0], this._out[i][1], index];
            this._allOutputs.set(index.toString(), img);
            out2.push(o);
        }
        (_a = this._view) === null || _a === void 0 ? void 0 : _a.webview.postMessage({ text: (out2) });
    }
    newInput(input) {
        var _a;
        (_a = this._view) === null || _a === void 0 ? void 0 : _a.webview.postMessage({
            text: [],
            input: input,
            output: ""
        });
    }
    newOutput(output) {
        var _a;
        let img = output
            .replace(`<div class="vertical"><span style="text-align:left" class="vertical-element">`, "")
            .replace(`</span><span style="text-align:left" class="vertical-element"><br></span></div>`, "");
        // .replace(`<?xml version="1.0" encoding="UTF-8"?>`,"");
        // console.log(img)
        (_a = this._view) === null || _a === void 0 ? void 0 : _a.webview.postMessage({
            text: [],
            input: "",
            output: img
        });
    }
    getOutputContent(webview, extensionUri) {
        let timeNow = new Date().getTime();
        const toolkitUri = getUri(webview, extensionUri, [
            "media",
            "toolkit.js"
        ]);
        const transformUri = getUri(webview, extensionUri, [
            "media",
            "transform.js"
        ]);
        const d3Uri = getUri(webview, extensionUri, [
            "media",
            "d3.min.js"
        ]);
        const graphicToSVG = getUri(webview, extensionUri, [
            "media",
            "graphicToSVG.js"
        ]);
        let result = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <style type="text/css">
    
                svg {
                    width:100%;
                }
                body{
                    overflow-y:scroll;
                    overflow-x:hidden;
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
    
                .outer {
                    height:100vh;
                    display:block;
                    position:relative;
                }
    
                #result-header {
                    display:block;
                    margin-top: 5px;
                    padding: 5px;
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                }
    
                #result {
                    font-family: var(--vscode-editor-font-family);
                    font-size: ${this._fontSize}px;
                    border-bottom: var(--vscode-editor-foreground) 2px solid;
                    margin-top: 5px;
                    padding: 10px;
                    display: block;
                    margin:0px;
                    width:90vw;
                    max-height:95vh;
                    object-fit:cover;
                    overflow-y:hidden;
                    image-rendering:auto;
                }

                .input_row {
                    background: var(--vscode-tree-tableOddRowsBackground);
                }

                .output_row {
                    background: var(--vscode-tree-tableEvenRowsBackground);
                    overflow-x: scroll;
                    font-size: ${this._fontSize}px;
                    max-height:50vh;
                    overflow-y: scroll;
                }

                .output_row img{
                    width: 98vw;
                }

                #errors {
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    color: #801f01;
                }
    
                #result img{
                    width:90vw;
                    max-height:95vh;
                    object-fit:contain;
                    /* margin: 0; */
                    /* min-height: 200px; */
                    width: auto;
                    margin-bottom: 5px;
                    margin-left: auto;
                    margin-right: auto;
                    display: block;
                }

                #download-link {
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    color: #801f01;
                    display: block;
                    margin-top: 5px;
                    padding: 5px;

                }
    
    
            </style>
            <meta charset="UTF-8">
    
            <meta
                http-equiv="Content-Security-Policy"
                content="default-src 'none'; 
                img-src 'self' data: ${webview.cspSource} file: vscode-resource: https:; 
                script-src 'self' ${webview.cspSource} 'unsafe-inline'; 
                style-src 'self' ${webview.cspSource} 'unsafe-inline';
                object-src 'self' ${webview.cspSource} 'unsafe-inline';"
            /> 

            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script type="module" src="${transformUri}"></script>
            <title>Plots</title>
        </head>
        <body onload="loaded()">
            <div class="outer">
                <div class="inner" id='outputs'>
                    <p>In: ... </p>
                </div>
            </div>
        </body>
        </html>` + invalidator();
        return result;
    }
}
exports.PlotsViewProvider = PlotsViewProvider;
PlotsViewProvider.viewType = "wolfram.plotsView";
function invalidator() {
    // VSCode tries to be smart and only does something if the webview HTML changed.
    // That means that our onload events aren't fired and you won't get a thumbnail
    // for repeated plots. Attaching a meaningless and random script snippet fixes that.
    return `<script>(function(){${Math.random()}})()</script>`;
}
function getUri(webview, extensionUri, pathList) {
    return webview.asWebviewUri(vscode_1.Uri.joinPath(extensionUri, ...pathList));
}
//# sourceMappingURL=plotsView.js.map