import * as vscode from 'vscode';
import * as fs from 'fs';
import { resolveGUID } from './guidUtilsProvider';
import * as utils from '../other/utils';
import * as path from 'path';
import { ASSETS_FILENAME_PATTERN, uniqueAssetName, assetNameWithOrigin } from '../other/assetsXml';
import * as minimatch from 'minimatch';

import { clearDiagnostics, diagnostics, refreshDiagnostics } from './assetsActionProvider';

// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {
  const assetPath = context.asAbsolutePath('./generated/');
  const allowedTags = JSON.parse(
      fs.readFileSync(assetPath + 'guids.json', { encoding: 'utf8' })) as { [index: string]: any };

  let timeout: NodeJS.Timer | undefined = undefined;

  // create a decorator type that we use to decorate small numbers
  const guidDecorationType = vscode.window.createTextEditorDecorationType({});
  const modOpDecorationType = vscode.window.createTextEditorDecorationType({});
  const assetDecorationType = vscode.window.createTextEditorDecorationType({});

  let activeEditor = vscode.window.activeTextEditor;

  function shortGuidDecorator(guid: string) {
    const resolved = resolveGUID(guid);
    if (!resolved) {
      return '';
    }

    return uniqueAssetName(resolved);
  }

  function decorationText(tag: string, guid: string, mod?: string) {
    const tagInfo = allowedTags[tag];
    if (tag !== 'BaseAssetGUID'
      && tag !== 'BonusNeed'
      && (!tagInfo
        || tagInfo.templates.length === 0
        || tag.endsWith('Amount')
        || tag === 'BuildModeRandomRotation')) {
      return '';
    }

    if (guid === '0') {
      return '(no target)';
    }
    else if (guid === '-1') {
      return '(not set)';
    }

    return assetNameWithOrigin(resolveGUID(guid), mod);
  }

  function updateDecorations() {
    if (!activeEditor) {
      return;
    }

    if (!minimatch(activeEditor.document.fileName, ASSETS_FILENAME_PATTERN)) {
      return;
    }

    const modName = path.basename(utils.searchModPath(activeEditor.document.uri.fsPath));

    const traverse = (activeEditor: vscode.TextEditor, color: string, 
      regex: RegExp, onMatch: (match: RegExpExecArray) => string, 
      type: vscode.TextEditorDecorationType) => {

      if (activeEditor.document.lineCount > 30000) {
        // ignore 30k+ lines
        return;
      }

      const text = activeEditor.document.getText();
      if (text.length > 1024 * 1024 * 10) {
        // ignore 10MB+ files
        return;
      }

      const guids: vscode.DecorationOptions[] = [];
      let match;
      while ((match = regex.exec(text))) {
        const startPos = activeEditor.document.positionAt(match.index);
        const endPos = activeEditor.document.positionAt(match.index + match[0].length);

        const text = onMatch(match);
        if (!text) {
          continue;
        }

        const decoration: vscode.DecorationOptions = {
          range: new vscode.Range(startPos, endPos),
          renderOptions: {
            after: {
              contentText: text,
              color: new vscode.ThemeColor(color),
              margin: '15px'
            }
          }
        };
        guids.push(decoration);
      }

      activeEditor.setDecorations(type, guids);
    };

    const traverse2 = (activeEditor: vscode.TextEditor, color: string, 
      regex: RegExp, onMatch: (match: RegExpExecArray) => string, 
      type: vscode.TextEditorDecorationType) => {

      if (activeEditor.document.lineCount > 30000) {
        // ignore 30k+ lines
        return;
      }

      const text = activeEditor.document.getText();
      if (text.length > 1024 * 1024 * 10) {
        // ignore 10MB+ files
        return;
      }

      const guids: vscode.DecorationOptions[] = [];
      let match;

      let matches: Array<RegExpExecArray> = [];
      while (match = regex.exec(text)) {
        matches = [match, ...matches];
      }

      for (const match of matches) {
        const startPos = activeEditor.document.positionAt(match.index);

        const lineAbove = Math.max(0, startPos.line);
        const lastIndex = activeEditor.document.lineAt(lineAbove).text.length;

        const endPos = new vscode.Position(lineAbove, lastIndex);

        const text = onMatch(match);
        if (!text) {
          continue;
        }

        const decoration: vscode.DecorationOptions = {
          range: new vscode.Range(endPos, endPos),
          renderOptions: {
            after: {
              contentText: text,
              color: new vscode.ThemeColor(color),
              margin: '3px'
            }
          }
        };
        guids.push(decoration);
      }

      activeEditor.setDecorations(type, guids);
    };

    let withinStandard = false;
    traverse(activeEditor, 'editorCodeLens.foreground', /(<\/?Standard>)|<(\w+)>(\d+)<\/\2>/g, (match) => {
      if (match[1] === '<Standard>') {
        withinStandard = true;
      }
      else if (match[1] === '</Standard>') {
        withinStandard = false;
      }
      else if (!withinStandard || (match[2] !== 'GUID' && match[2] !== 'Name')) {
        return decorationText(match[2], match[3], modName);
      }

      return '';
    }, guidDecorationType);

    // traverse2(activeEditor, 'editorCodeLens.foreground', /(?<=GUID='|"|,| )(\d+)(?= |,|"|')/g, (match) => {
    //   return shortGuidDecorator(match[1]);
    // }, modOpDecorationType);

    traverse(activeEditor, 'editorCodeLens.foreground', /<Asset>/g, (match) => {
      const doc = activeEditor?.document;
      if (!doc) {
        return '';
      }

      const startPos = doc.positionAt(match.index);
      let standard = doc.getText(new vscode.Range(startPos.line, startPos.character, startPos.line + 20, 0));
      const endPos = standard.indexOf('</Asset>');
      if (endPos >= 0) {
        standard = standard.substring(0, endPos);
      }
      const guidRegex = /<GUID>(\d+)<\/GUID>/g;
      let guidMatch = guidRegex.exec(standard);
      if (!guidMatch) {
        return '';
      }
      return decorationText('GUID', guidMatch[1]);
    }, assetDecorationType);
  }

  function updateAssetAndPerformanceDecorations() {
    if (!activeEditor) {
      return;
    }

    updateDecorations();
    refreshDiagnostics(context, activeEditor.document, diagnostics);
  }

  function clearPerformanceDecorations() {
    if (!activeEditor) {
      return;
    }
    clearDiagnostics(context, activeEditor.document, diagnostics);
  }

  function triggerUpdateDecorations(throttle = false, performance = false) {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    if (throttle) {
      timeout = setTimeout(performance ? updateAssetAndPerformanceDecorations : updateDecorations, 500);
    } else {
      updateAssetAndPerformanceDecorations();
    }
  }

  if (activeEditor) {
    triggerUpdateDecorations();
  }

  vscode.window.onDidChangeActiveTextEditor(editor => {
    activeEditor = editor;
    if (editor) {
      triggerUpdateDecorations();
    }
  }, null, context.subscriptions);

  vscode.workspace.onDidChangeTextDocument(event => {
    if (activeEditor && event.document === activeEditor.document) {
      triggerUpdateDecorations(true);
      clearPerformanceDecorations();
    }
  }, null, context.subscriptions);


  vscode.workspace.onDidSaveTextDocument(event => {
    if (activeEditor) {
      triggerUpdateDecorations(true, true);
    }
  }, null, context.subscriptions);
}
