import * as vscode from 'vscode'
import type { TreeNode } from './model'

/** A tree view over model nodes. `set()` replaces the nodes and redraws. */
export class NodeTree implements vscode.TreeDataProvider<TreeNode> {
  private nodes: TreeNode[] = []
  private readonly changed = new vscode.EventEmitter<TreeNode | undefined>()
  readonly onDidChangeTreeData = this.changed.event

  constructor(private readonly root: () => string | undefined) {}

  set(nodes: TreeNode[]): void {
    this.nodes = nodes
    this.changed.fire(undefined)
  }

  getChildren(element?: TreeNode): TreeNode[] {
    return element ? (element.children ?? []) : this.nodes
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    const state = node.children?.length
      ? node.expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None
    const item = new vscode.TreeItem(node.label, state)
    item.id = node.id
    item.description = node.description
    item.tooltip = node.tooltip
    item.contextValue = node.contextValue
    if (node.icon) item.iconPath = new vscode.ThemeIcon(node.icon)
    const root = this.root()
    if (node.command) item.command = { title: node.label, ...node.command }
    else if (node.open && root) {
      item.resourceUri = vscode.Uri.joinPath(vscode.Uri.file(root), node.open)
      item.command = { title: 'Open', command: 'kitr.open', arguments: [node.open, node.line] }
    }
    return item
  }

  dispose(): void {
    this.changed.dispose()
  }
}
