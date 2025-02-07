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
exports.workspaceSymbolProvider = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const clients_1 = require("./clients");
class TreeItem extends vscode.TreeItem {
    constructor(label, children) {
        super(label, children === undefined ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
        this.children = children;
        this.location = "";
        this.lazyload = "";
    }
}
let workspace_items = {};
let builtins;
let workspace;
class workspaceSymbolProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.data = [];
        this.cancelChildrenToken = undefined;
        let doc = new TreeItem("Documentation Center");
        doc.command = { command: 'wolfram.wolframHelp', arguments: [
                "https://reference.wolfram.com/language/"
            ], title: 'Open' };
        let functionRepository = new TreeItem("Function Repository");
        functionRepository.command = { command: 'wolfram.wolframHelp', arguments: [
                "https://resources.wolframcloud.com/FunctionRepository/"
            ], title: 'Open' };
        builtins = new TreeItem("Builtins", []);
        workspace = new TreeItem("Workspace", []);
        this.data = [doc, functionRepository, builtins, workspace];
        // this.getBuiltins();
        // this.getSymbols([]);
        // this.builtins new TreeItem("Builtins", []);
        // this.cancelChildrenToken = undefined;
    }
    getBuiltins() {
        return __awaiter(this, void 0, void 0, function* () {
            clients_1.wolframClient === null || clients_1.wolframClient === void 0 ? void 0 : clients_1.wolframClient.sendRequest("builtInList").then((file) => {
                fs.readFile(file, 'utf8', (err, data) => {
                    var _a;
                    let result = JSON.parse(data.toString());
                    let files = [];
                    // get all the letters in the alphabet
                    let letters = [];
                    for (let i = 65; i < 91; i++) {
                        letters.push(String.fromCharCode(i));
                    }
                    let builtinsymbols = result.builtins.map((symbol) => {
                        let item = new vscode.TreeItem(symbol.name);
                        item.tooltip = symbol.definition;
                        let e = vscode.window.activeTextEditor;
                        item.command = { command: 'wolfram.stringHelp', arguments: [
                                symbol.name
                            ], title: 'Open' };
                        //item.command = {command: 'editor.action.addCommentLine', arguments: [], title: 'Add Comment'};
                        return item;
                    });
                    if (((_a = builtins.children) === null || _a === void 0 ? void 0 : _a.length) === 0) {
                        builtins = new TreeItem("Builtins", letters.map((letter) => {
                            return new TreeItem(letter, builtinsymbols.filter((item) => { var _a; return (_a = item.label) === null || _a === void 0 ? void 0 : _a.toString().startsWith(letter); }));
                        }));
                    }
                    let doc = new TreeItem("Documentation Center");
                    doc.command = { command: 'wolfram.wolframHelp', arguments: [
                            "https://reference.wolfram.com/language/"
                        ], title: 'Open' };
                    let functionRepository = new TreeItem("Function Repository");
                    functionRepository.command = { command: 'wolfram.wolframHelp', arguments: [
                            "https://resources.wolframcloud.com/FunctionRepository/"
                        ], title: 'Open' };
                    this.data = [doc, functionRepository, builtins, workspace];
                    this._onDidChangeTreeData.fire();
                });
            });
        });
    }
    getSymbols(symbols) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (((_a = workspace.children) === null || _a === void 0 ? void 0 : _a.length) === 0) {
                function getFolderFiles(folder) {
                    let files = fs.readdirSync(folder, { withFileTypes: true });
                    files.forEach((file) => {
                        var _a;
                        if (path.extname(file.name) == ".wl") {
                            let item = new TreeItem(path.basename(file.name), []);
                            item.tooltip = file.name;
                            item.children = [];
                            item.lazyload = "getFileSymbols[\"" + folder + "/" + file.name + "\", \"" + vscode.Uri.parse(file.name) + "\"]";
                            item.location = file.name;
                            item.resourceUri = vscode.Uri.parse(file.name);
                            item.iconPath = new vscode.ThemeIcon("file-code");
                            item.command = { command: 'vscode.open', arguments: [vscode.Uri.parse(file.name)], title: 'Open' };
                            (_a = workspace.children) === null || _a === void 0 ? void 0 : _a.push(item);
                        }
                        if (file.isDirectory()) {
                            getFolderFiles(folder + "/" + file.name);
                        }
                    });
                }
                let folders = vscode.workspace.workspaceFolders;
                folders === null || folders === void 0 ? void 0 : folders.forEach((folder) => {
                    getFolderFiles(folder.uri.fsPath);
                });
                workspace.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                // Object.keys(this.workspace_items).forEach((key:string) => { 
                //     newItems.children?.push(this.workspace_items[key]);
                // })
                this.data = [builtins, workspace];
                this._onDidChangeTreeData.fire();
            }
        });
    }
    refresh() {
        // this.getSymbols([]);
        this._onDidChangeTreeData.fire(undefined);
    }
    readSymbolsFile(file) {
        let out = [];
        fs.readFile(file, 'utf8', (err, data) => {
            function symbolToTreeItem(symbol) {
                var _a, _b;
                let item = new TreeItem((_a = symbol.label) === null || _a === void 0 ? void 0 : _a.slice(0, 8192), []);
                item.tooltip = (_b = symbol.definition) === null || _b === void 0 ? void 0 : _b.slice(0, 8192);
                item.children = symbol.children;
                item.lazyload = symbol.lazyload;
                item.location = symbol.location;
                item.resourceUri = vscode.Uri.parse(symbol.location["uri"]);
                item.iconPath = new vscode.ThemeIcon(symbol.icon);
                item.command = { command: 'vscode.open', arguments: [vscode.Uri.parse(symbol.location["uri"])], title: 'Open' };
                return item;
                // if (symbol.children && symbol.children.length > 0) {
                //     item.children = symbol.children.map((child:any) => {
                //         return symbolToTreeItem(child);
                //     })
                //     return item 
                // } else {
                //     item.collapsibleState = vscode.TreeItemCollapsibleState.None;
                //     return item
                // }
            }
            let result = JSON.parse(data.toString());
            workspace_items = {};
            let newSymbols = result.map((symbol) => {
                let item = symbolToTreeItem(symbol);
                return item;
            });
            out = newSymbols;
        });
        return out;
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        return __awaiter(this, void 0, void 0, function* () {
            // treeDataProvider.refresh();
            if (element === undefined) {
                return this.data;
            }
            if (element.lazyload === "") {
                return element.children;
            }
            else {
                return new Promise((resolve, reject) => {
                    let tokenSource = new vscode.CancellationTokenSource();
                    this.cancelChildrenToken = tokenSource.token;
                    setTimeout(() => {
                        var _a;
                        if (!((_a = this.cancelChildrenToken) === null || _a === void 0 ? void 0 : _a.isCancellationRequested)) {
                            tokenSource.cancel();
                            resolve([]);
                            return;
                        }
                    }, 5000);
                    clients_1.wolframKernelClient === null || clients_1.wolframKernelClient === void 0 ? void 0 : clients_1.wolframKernelClient.sendRequest("getChildren", element.lazyload).then((file) => {
                        var _a;
                        if ((_a = this.cancelChildrenToken) === null || _a === void 0 ? void 0 : _a.isCancellationRequested) {
                            return [];
                        }
                        else {
                            let children = [];
                            let result = JSON.parse(fs.readFileSync(file, 'ascii'));
                            if (result.length > 0) {
                                children = result.map((item) => {
                                    let newItem = new TreeItem(item.label, []);
                                    newItem.tooltip = item.definition;
                                    newItem.lazyload = item.lazyload;
                                    newItem.iconPath = new vscode.ThemeIcon(item.icon);
                                    newItem.location = item.location;
                                    newItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                                    if (Object.keys(item).includes("location") && Object.keys(item.location).includes("uri")) {
                                        newItem.resourceUri = vscode.Uri.parse(item.location["uri"]);
                                        newItem.command = { command: 'vscode.open', arguments: [vscode.Uri.parse(item.location["uri"]), {
                                                    preview: false,
                                                    preserveFocus: false,
                                                    selection: item.location.range
                                                }], title: 'Open' };
                                        vscode.window.showTextDocument(vscode.Uri.parse(item.location["uri"]), { preview: true });
                                    }
                                    return newItem;
                                });
                                element.children = children;
                                tokenSource.dispose();
                                // return [new TreeItem("Testing", [])]; 
                                resolve(children);
                                return;
                            }
                            if (typeof (result) === "object") {
                                let newItem = new TreeItem(result.label, []);
                                newItem.tooltip = result.definition;
                                newItem.lazyload = result.lazyload;
                                newItem.iconPath = new vscode.ThemeIcon(result.icon);
                                newItem.location = result.location;
                                newItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                                if (Object.keys(result).includes("location") && Object.keys(result.location).includes("uri")) {
                                    newItem.resourceUri = vscode.Uri.parse(result.location["uri"]);
                                    newItem.command = { command: 'vscode.open', arguments: [vscode.Uri.parse(result.location["uri"]), {
                                                preview: false,
                                                preserveFocus: false,
                                                selection: result.location.range
                                            }], title: 'Open' };
                                    vscode.window.showTextDocument(vscode.Uri.parse(result.location["uri"]), { preview: true });
                                }
                                children = [newItem];
                                element.children = children;
                            }
                            else {
                                children = [];
                                element.collapsibleState = vscode.TreeItemCollapsibleState.None;
                            }
                            tokenSource.dispose();
                            // return [new TreeItem("Testing", [])]; 
                            resolve(children);
                            // return children
                        }
                    });
                });
            }
        });
    }
}
exports.workspaceSymbolProvider = workspaceSymbolProvider;
//# sourceMappingURL=treeDataProvider.js.map