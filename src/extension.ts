import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand("tsExportAll.generate", generateExport));
}

async function generateExport() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document.fileName.endsWith(".ts")) return;

  const config = vscode.workspace.getConfiguration("tsExportAll");
  const indexBehavior = config.get<string>("indexBehavior", "index");
  const includeExtension = config.get<boolean>("includeExtension", false);

  const file = editor.document.fileName;
  const dir = path.dirname(file);
  const exports = scanFolder(dir, dir, indexBehavior, includeExtension, file);

  await editor.edit(edit => {
    const range = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(editor.document.getText().length));
    edit.replace(range, exports.map(item => `export * from '${item}'`).join("\n"));
  });
}

function scanFolder(root: string, current: string, indexBehavior: string, includeExtension: boolean, currentFile: string): string[] {
  const result: string[] = [];
  const entries = fs.readdirSync(current);
  const hasIndex = entries.includes("index.ts");

  if (hasIndex && current !== root) {
    if (indexBehavior === "skip") return [];

    if (indexBehavior === "index") {
      return [toImportPath(root, current, includeExtension)];
    }
  }

  for (const name of entries) {
    const full = path.join(current, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      result.push(...scanFolder(root, full, indexBehavior, includeExtension, currentFile));
      continue;
    }

    if (!name.endsWith(".ts")) continue;

    // 无论任何模式，都不能导出当前正在执行命令的文件，避免自身引用。
    if (full === currentFile) continue;

    if (name === "index.ts") {
      if (indexBehavior === "all") {
        result.push(toImportPath(root, full, includeExtension));
      }
      continue;
    }

    if (hasIndex && indexBehavior === "index") continue;

    result.push(toImportPath(root, full, includeExtension));
  }

  return result;
}

function toImportPath(root: string, target: string, includeExtension: boolean): string {
  let relative = path.relative(root, target).replace(/\\/g, "/");

  if (!includeExtension) {
    relative = relative.replace(/\.ts$/, "");
  }

  if (relative.endsWith("/index")) {
    relative = relative.substring(0, relative.length - 6);
  }

  if (!relative.startsWith(".")) {
    relative = "./" + relative;
  }

  return relative;
}

export function deactivate() { }