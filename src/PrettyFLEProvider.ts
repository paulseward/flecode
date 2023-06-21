import { EventEmitter, TextDocumentContentProvider, Uri, workspace } from "vscode";
import { EditorRedrawWatcher } from "./EditorRedrawWatcher";
import { spawnSync } from "child_process";
import * as vscode from 'vscode';

import { posix as posixPath } from "path";
import { TextDecoder } from "util";

export class PrettyFLEProvider implements TextDocumentContentProvider {
    public static readonly scheme = `flecode.pretty`;
    public static toProviderUri(actualUri: Uri): Uri {
        const tabName = "Preview: " + posixPath.basename(actualUri.path);
    
        const scheme = PrettyFLEProvider.scheme;
        const path = encodeURIComponent(tabName);
        const query = encodeURIComponent(actualUri.toString());
    
        return Uri.parse(`${scheme}://show/${path}?${query}`, true);
      }
      public static toActualUri(providerUri: Uri): Uri {
        if (providerUri.scheme !== PrettyFLEProvider.scheme) {
          throw new Error(`wrong uri scheme: ${providerUri.scheme}`);
        }
    
        return Uri.parse(providerUri.query, true);
      }

  private readonly _onDidChange = new EventEmitter<Uri>();
  public readonly onDidChange = this._onDidChange.event;

  private readonly _watchedUris = new Set<string>();

  private readonly _editorRedrawWatcher: EditorRedrawWatcher;

  public constructor(editorRedrawWatcher: EditorRedrawWatcher) {
    this._editorRedrawWatcher = editorRedrawWatcher;

    this._disposables.push(
      workspace.onDidChangeTextDocument((event) => {
        const actualUri = event.document.uri;

        if (this._watchedUris.has(actualUri.toString())) {
          const providerUri = PrettyFLEProvider.toProviderUri(actualUri);
          this._onDidChange.fire(providerUri);
        }
      })
    );

    this._disposables.push(
      workspace.onDidCloseTextDocument((document) => {
        this._watchedUris.delete(document.uri.toString());
      })
    );
  }

  public async provideTextDocumentContent(providerUri: Uri): Promise<string> {
    // VS Code does not emit `workspace.onDidChangeTextDocument` for the provided document
    // if the content is identical to the current one, despite us emitting `onDidChange`.

    // it means that we have to force-emit `onEditorRedraw` to correctly handle situations
    // when the escapes change, but the content itself remains the same.
    setImmediate(() => this._editorRedrawWatcher.forceEmitForUri(providerUri));

    const actualUri = PrettyFLEProvider.toActualUri(providerUri);

    this._watchedUris.add(actualUri.toString());

    const actualDocument = await workspace.openTextDocument(actualUri);
    const actualText = actualDocument.getText();
    var path = vscode.workspace.getConfiguration('flecode').get("flecliPath","flicli");
    var child = spawnSync(path, ["load","-i", "/dev/stdin"], { input: actualText });
    if (child.error && child.error.message.indexOf("ENOENT") != -1){
			vscode.window.showErrorMessage("ENOENT error launching flecli - have you installed it?");
      return ""
		}
    
    //const spans = new ansi.Parser().chunk(actualDocument.getText(), true);
    return new TextDecoder().decode(child.stdout); //spans.map((span) => actualText.substr(span.offset, span.length)).join("");
  }

  private readonly _disposables: { dispose(): void }[] = [];
  private _isDisposed = false;

  public dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;

    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }
}