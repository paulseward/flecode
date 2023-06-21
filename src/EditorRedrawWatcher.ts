import { EventEmitter, TextEditor, Uri, window, workspace } from "vscode";

export class EditorRedrawWatcher {
  private readonly _onEditorRedraw = new EventEmitter<TextEditor>();
  public readonly onEditorRedraw = this._onEditorRedraw.event;

  private _visibleEditorSubscriptions: { dispose(): void }[] = [];

  private _updateVisibleEditorSubscriptions(editors: TextEditor[]): void {
    for (const subscription of this._visibleEditorSubscriptions) {
      subscription.dispose();
    }

    this._visibleEditorSubscriptions = editors.map((editor) =>
      workspace.onDidChangeTextDocument((event) => {
        if (event.document !== editor.document) {
          return;
        }

        this._onEditorRedraw.fire(editor);
      })
    );
  }

  public constructor() {
    this._disposables.push(
      workspace.onDidOpenTextDocument((document) => {
        for (const editor of window.visibleTextEditors) {
          if (editor.document === document) {
            this._onEditorRedraw.fire(editor);
          }
        }
      }),

      window.onDidChangeVisibleTextEditors((editors) => {
        this._updateVisibleEditorSubscriptions(editors);

        for (const editor of editors) {
          this._onEditorRedraw.fire(editor);
        }
      })
    );

    this._updateVisibleEditorSubscriptions(window.visibleTextEditors);

    setImmediate(() => {
      for (const editor of window.visibleTextEditors) {
        this._onEditorRedraw.fire(editor);
      }
    });
  }

  public forceEmitForUri(uri: Uri): void {
    for (const editor of window.visibleTextEditors) {
      if (editor.document.uri.toString() === uri.toString()) {
        this._onEditorRedraw.fire(editor);
      }
    }
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