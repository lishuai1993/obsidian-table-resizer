import { Plugin, MarkdownView, Notice } from 'obsidian';

interface TableResizerSettings {
	enableResizer: boolean;
	minColumnWidth: number;
	maxColumnWidth: number;
	saveWidths: boolean;
}

const DEFAULT_SETTINGS: TableResizerSettings = {
	enableResizer: true,
	minColumnWidth: 50,
	maxColumnWidth: 800,
	saveWidths: true
}

interface StoredData {
	enableResizer?: boolean;
	minColumnWidth?: number;
	maxColumnWidth?: number;
	saveWidths?: boolean;
	tableWidths?: Record<string, Record<string, number>>;
}

export default class TableResizerPlugin extends Plugin {
	settings: TableResizerSettings = Object.assign({}, DEFAULT_SETTINGS);
	private isDragging: boolean = false;
	private currentTable: HTMLTableElement | null = null;
	private currentColumn: number = -1;
	private startX: number = 0;
	private startWidth: number = 0;
	private resizerLine: HTMLElement | null = null;
	private tableWidths: Map<string, Map<number, number>> = new Map();
	private mutationObservers: Map<Element, MutationObserver> = new Map();
	private mutationReapplyPending: boolean = false;
	private isApplyingWidths: boolean = false;
	private widthSaveTimer: number | null = null;
	private keyupDebounceTimer: number | null = null;
	private periodicScanInterval: number | null = null;

	async onload() {
		try {
			this.settings = Object.assign({}, DEFAULT_SETTINGS);

			await this.loadSettings();

			this.registerEvent(
				this.app.workspace.on('layout-change', () => {
					this.initTables();
					window.setTimeout(() => {
						this.applyAllStoredWidths();
					}, 100);
				})
			);

			this.registerEvent(
				this.app.workspace.on('active-leaf-change', () => {
					this.initTables();
					window.setTimeout(() => {
						this.applyAllStoredWidths();
					}, 100);
				})
			);

			this.registerEvent(
				this.app.workspace.on('file-open', () => {
					window.setTimeout(() => {
						this.initTables();
						this.applyAllStoredWidths();
					}, 200);
				})
			);

			// keyup listener: detect new tables created by typing in Live Preview
			// CM6 may defer table widget rendering, so keyup + periodic scan are needed
			this.registerDomEvent(document, 'keyup', () => {
				if (this.keyupDebounceTimer !== null) {
					window.clearTimeout(this.keyupDebounceTimer);
				}
				this.keyupDebounceTimer = window.setTimeout(() => {
					this.keyupDebounceTimer = null;
					this.initTables();
					window.requestAnimationFrame(() => {
						this.applyAllStoredWidths();
					});
				}, 500);
			});

			// Periodic scan: safety net to catch any missed new tables (every 8s)
			this.periodicScanInterval = window.setInterval(() => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && this.settings.enableResizer) {
					this.initTables();
					this.applyAllStoredWidths();
				}
			}, 8000);
			this.registerInterval(this.periodicScanInterval);

			this.addCommand({
				id: 'toggle-resizing',
				name: 'Toggle resizing',
				callback: () => {
					this.settings.enableResizer = !this.settings.enableResizer;
					void this.saveSettings();
					new Notice(`Table resizer ${this.settings.enableResizer ? 'enabled' : 'disabled'}`);
					this.initTables();
				}
			});

			this.app.workspace.onLayoutReady(() => {
				window.setTimeout(() => {
					this.initTables();
					this.applyAllStoredWidths();
				}, 100);
			});
		} catch (error) {
			console.error('Failed to load Table Resizer plugin:', error);
		}
	}

	private initTables() {
		try {
			const markdownViews = this.app.workspace.getLeavesOfType('markdown');

			if (!markdownViews || markdownViews.length === 0) {
				return;
			}

			markdownViews.forEach(leaf => {
				try {
					const view = leaf.view as MarkdownView;

					if (!view || !view.contentEl) {
						return;
					}

					// Setup MutationObserver for this view (will skip if already set up)
					this.setupMutationObserver(view.contentEl);

					// Reading View
					const previewEl = view.contentEl.querySelector('.markdown-preview-view') ||
						view.contentEl.querySelector('.markdown-reading-view') ||
						view.contentEl.querySelector('.markdown-preview-sizer');

					if (previewEl) {
						this.processTables(previewEl as HTMLElement);
					}

					// Editing View (Live Preview)
					const sourceEl = view.contentEl.querySelector('.markdown-source-view') ||
						view.contentEl.querySelector('.cm-content') ||
						view.contentEl.querySelector('.CodeMirror-code');

					if (sourceEl) {
						this.processTables(sourceEl as HTMLElement);
					}

					if (!previewEl && !sourceEl) {
						this.processTables(view.contentEl);
					}
				} catch (error) {
					console.warn('Error processing view:', error);
				}
			});
		} catch (error) {
			console.error('Error in initTables:', error);
		}
	}

	private setupMutationObserver(container: HTMLElement) {
		// Skip if already observing this container
		if (this.mutationObservers.has(container)) {
			return;
		}

		const observer = new MutationObserver((mutations) => {
			// Skip if we're the ones making changes
			if (this.isApplyingWidths) {
				return;
			}

			let tableRelated = false;

			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					for (const node of mutation.addedNodes) {
						if (node.instanceOf(HTMLElement)) {
							if (node.tagName === 'TABLE' || node.querySelector('table')) {
								tableRelated = true;
								break;
							}
						}
					}
					if (!tableRelated) {
						for (const node of mutation.removedNodes) {
							if (node.instanceOf(HTMLElement)) {
								if (node.tagName === 'TABLE' || node.querySelector('table')) {
									tableRelated = true;
									break;
								}
							}
						}
					}
					if (!tableRelated && mutation.target.instanceOf(HTMLElement)) {
						if (mutation.target.closest('table')) {
							tableRelated = true;
						}
					}
				} else if (mutation.type === 'characterData') {
					if (mutation.target.instanceOf(Node) && mutation.target.parentElement) {
						if (mutation.target.parentElement.closest('table')) {
							tableRelated = true;
						}
					}
				}
				if (tableRelated) break;
			}

			if (tableRelated) {
				this.scheduleMutationReapply();
			}
		});

		observer.observe(container, {
			childList: true,
			subtree: true,
			characterData: true,
		});

		this.mutationObservers.set(container, observer);
	}

	private scheduleMutationReapply() {
		if (this.mutationReapplyPending) return;
		this.mutationReapplyPending = true;
		// CM6 renders synchronously — queueMicrotask is fast enough to avoid visible flicker
		queueMicrotask(() => {
			this.mutationReapplyPending = false;
			this.initTables();
			// Two rAF rounds to guard against any async re-renders
			window.requestAnimationFrame(() => {
				this.applyAllStoredWidths();
				window.requestAnimationFrame(() => {
					this.applyAllStoredWidths();
				});
			});
		});
	}

	private processTables(container: HTMLElement) {
		const tables = container.querySelectorAll('table');

		tables.forEach((table) => {
			if (this.settings.enableResizer) {
				this.enableResizing(table);
				this.applyStoredWidths(table);
			} else {
				this.disableResizing(table);
			}
		});
	}

	private enableResizing(table: HTMLTableElement) {
		const hadClass = table.classList.contains('table-resizer-active');

		table.classList.add('table-resizer-active');

		const rows = table.querySelectorAll('tr');
		if (!rows || rows.length === 0) {
			return;
		}

		const totalCells = Array.from(rows).reduce((sum, row) => sum + row.querySelectorAll('th, td').length, 0);
		const existingHandles = table.querySelectorAll('.table-resizer-handle').length;

		if (hadClass && existingHandles >= totalCells) {
			return;
		}

		// Add/restore resizer handles for all cells
		this.isApplyingWidths = true;
		rows.forEach(row => {
			const cells = row.querySelectorAll('th, td');
			cells.forEach((cell, index) => {
				const el = cell as HTMLElement;
				if (!cell.querySelector('.table-resizer-handle')) {
					this.addResizerHandle(el, table, index);
				}
			});
		});
		this.isApplyingWidths = false;

		// Register global listeners (safe to call multiple times)
		document.removeEventListener('mousemove', this.handleMouseMove);
		document.removeEventListener('mouseup', this.handleMouseUp);
		document.addEventListener('mousemove', this.handleMouseMove);
		document.addEventListener('mouseup', this.handleMouseUp);
	}

	private disableResizing(table: HTMLTableElement) {
		table.classList.remove('table-resizer-active');
		table.classList.remove('table-resizer-fixed');
		const handles = table.querySelectorAll('.table-resizer-handle');
		handles.forEach(handle => handle.remove());
	}

	private addResizerHandle(cell: HTMLElement, table: HTMLTableElement, columnIndex: number) {
		if (cell.querySelector('.table-resizer-handle')) {
			return;
		}

		const handle = cell.createEl('div', { cls: 'table-resizer-handle' });
		handle.dataset.column = columnIndex.toString();

		handle.addEventListener('mousedown', (e: MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			this.startDrag(e, table, columnIndex);
		});

		handle.addEventListener('touchstart', (e: TouchEvent) => {
			e.preventDefault();
			e.stopPropagation();
			const touch = e.touches[0];
			this.startDrag({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent, table, columnIndex);
		}, { passive: false });
	}

	private startDrag(e: MouseEvent, table: HTMLTableElement, columnIndex: number) {
		this.isDragging = true;
		this.currentTable = table;
		this.currentColumn = columnIndex;
		this.startX = e.clientX;

		const firstRow = table.querySelector('tr');
		if (!firstRow) return;

		const cell = firstRow.querySelectorAll('th, td')[columnIndex];
		this.startWidth = (cell as HTMLElement).offsetWidth;

		document.body.classList.add('table-resizer-dragging');

		const allHandles = table.querySelectorAll('.table-resizer-handle');
		allHandles.forEach(handle => {
			if (handle.getAttribute('data-column') === columnIndex.toString()) {
				handle.classList.add('dragging');
			}
		});
	}

	private handleMouseMove = (e: MouseEvent) => {
		if (!this.isDragging || !this.currentTable) return;

		const diff = e.clientX - this.startX;
		const newWidth = this.startWidth + diff;

		const clampedWidth = Math.max(
			this.settings.minColumnWidth,
			Math.min(this.settings.maxColumnWidth, newWidth)
		);

		this.applyColumnWidth(this.currentTable, this.currentColumn, clampedWidth);
	}

	private handleMouseUp = () => {
		if (!this.isDragging) return;

		const draggedTable = this.currentTable;
		const draggedColumn = this.currentColumn;

		this.isDragging = false;
		document.body.classList.remove('table-resizer-dragging');

		if (draggedTable) {
			const handles = draggedTable.querySelectorAll('.table-resizer-handle');
			handles.forEach(handle => handle.classList.remove('dragging'));
		}

		if (this.settings.saveWidths && draggedTable) {
			this.updateMarkdownTable(draggedTable);
		}

		// Multi-round rAF to confirm width sticks against CM6 async re-renders
		if (draggedTable && draggedColumn >= 0) {
			const tableId = this.getTableIdentifier(draggedTable);
			const storedWidths = this.tableWidths.get(tableId);
			const expectedWidth = storedWidths?.get(draggedColumn);
			if (expectedWidth) {
				// Round 1
				window.requestAnimationFrame(() => {
					this.confirmColumnWidth(draggedTable, draggedColumn, expectedWidth);
					// Round 2
					window.requestAnimationFrame(() => {
						this.confirmColumnWidth(draggedTable, draggedColumn, expectedWidth);
						// Round 3
						window.setTimeout(() => {
							this.confirmColumnWidth(draggedTable, draggedColumn, expectedWidth);
						}, 100);
					});
				});
			}
		}

		this.currentTable = null;
		this.currentColumn = -1;
	}

	private confirmColumnWidth(table: HTMLTableElement, columnIndex: number, expectedWidth: number) {
		const firstRow = table.querySelector('tr');
		if (!firstRow) return;
		const cell = firstRow.querySelectorAll('th, td')[columnIndex] as HTMLElement;
		if (!cell) return;
		const currentWidth = cell.style.width;
		if (currentWidth !== `${expectedWidth}px`) {
			this.isApplyingWidths = true;
			const rows = table.querySelectorAll('tr');
			rows.forEach(row => {
				const cells = row.querySelectorAll('th, td');
				if (cells[columnIndex]) {
					const c = cells[columnIndex] as HTMLElement;
					c.style.width = `${expectedWidth}px`;
					c.style.minWidth = `${expectedWidth}px`;
					c.style.maxWidth = `${expectedWidth}px`;
				}
			});
			this.isApplyingWidths = false;
		}
	}

	private applyColumnWidth(table: HTMLTableElement, columnIndex: number, width: number) {
		const rows = table.querySelectorAll('tr');

		// Force table-layout:fixed so the browser respects explicit column widths
		table.classList.add('table-resizer-fixed');

		// Mark that we're applying widths (to prevent MutationObserver loops)
		this.isApplyingWidths = true;

		rows.forEach(row => {
			const cells = row.querySelectorAll('th, td');
			if (cells[columnIndex]) {
				const cell = cells[columnIndex] as HTMLElement;
				cell.style.width = `${width}px`;
				cell.style.minWidth = `${width}px`;
				cell.style.maxWidth = `${width}px`;
			}
		});

		this.isApplyingWidths = false;

		// Save to memory
		this.saveTableColumnWidth(table, columnIndex, width);

		// Double-confirm with requestAnimationFrame (guard against async re-renders)
		window.requestAnimationFrame(() => {
			const rowsNow = table.querySelectorAll('tr');
			rowsNow.forEach(row => {
				const cells = row.querySelectorAll('th, td');
				if (cells[columnIndex]) {
					const cell = cells[columnIndex] as HTMLElement;
					if (cell.style.width !== `${width}px`) {
						this.isApplyingWidths = true;
						cell.style.width = `${width}px`;
						cell.style.minWidth = `${width}px`;
						cell.style.maxWidth = `${width}px`;
						this.isApplyingWidths = false;
					}
				}
			});
		});
	}

	private saveTableColumnWidth(table: HTMLTableElement, columnIndex: number, width: number) {
		const tableId = this.getTableIdentifier(table);

		if (!this.tableWidths.has(tableId)) {
			this.tableWidths.set(tableId, new Map());
		}

		this.tableWidths.get(tableId)!.set(columnIndex, width);
		// Persist to disk (debounced)
		this.persistWidths();
	}

	private serializeWidths(): Record<string, Record<string, number>> {
		const result: Record<string, Record<string, number>> = {};
		this.tableWidths.forEach((cols, tableId) => {
			const colObj: Record<string, number> = {};
			cols.forEach((width, colIndex) => {
				colObj[String(colIndex)] = width;
			});
			if (Object.keys(colObj).length > 0) {
				result[tableId] = colObj;
			}
		});
		return result;
	}

	private deserializeWidths(data: Record<string, Record<string, number>>) {
		this.tableWidths.clear();
		for (const [tableId, cols] of Object.entries(data)) {
			const colMap = new Map<number, number>();
			for (const [colStr, width] of Object.entries(cols)) {
				colMap.set(Number(colStr), width);
			}
			this.tableWidths.set(tableId, colMap);
		}
	}

	private persistWidths() {
		if (this.widthSaveTimer !== null) {
			window.clearTimeout(this.widthSaveTimer);
		}
		this.widthSaveTimer = window.setTimeout(() => {
			this.widthSaveTimer = null;
			void this.saveSettings();
		}, 500);
	}

	private getTableIdentifier(table: HTMLTableElement): string {
		// Try to find file path from the view containing this table (more reliable than getActiveFile)
		let filePath = 'unknown';
		try {
			const views = this.app.workspace.getLeavesOfType('markdown');
			for (const leaf of views) {
				const view = leaf.view as MarkdownView;
				if (view && view.contentEl && view.contentEl.contains(table)) {
					filePath = view.file?.path || 'unknown';
					break;
				}
			}
			// Fallback to active file if not found in any view
			if (filePath === 'unknown') {
				const activeFile = this.app.workspace?.getActiveFile?.();
				filePath = activeFile ? activeFile.path : 'unknown';
			}
		} catch {
			// ignore
		}

		// Get table index within its container for positional stability
		let tableIndex = 0;
		const container = table.closest('.markdown-source-view, .markdown-preview-view, .markdown-reading-view, .cm-content, .markdown-preview-sizer');
		if (container) {
			const allTables = Array.from(container.querySelectorAll('table'));
			tableIndex = allTables.indexOf(table);
			if (tableIndex < 0) tableIndex = 0;
		}

		const dimensions = this.getTableContentHash(table);
		return `${filePath}-idx${tableIndex}-${dimensions}`;
	}

	private getTableContentHash(table: HTMLTableElement): string {
		const rows = table.querySelectorAll('tr');
		if (rows.length === 0) return 'empty';

		const firstRow = rows[0];
		const cells = firstRow.querySelectorAll('th, td');
		const columnCount = cells.length;

		// Use all cells in first row for better uniqueness
		// Row count intentionally excluded so adding/removing rows doesn't change the ID
		let contentHash = '';
		cells.forEach((cell) => {
			const text = cell.textContent?.trim().substring(0, 30) || '';
			contentHash += text.replace(/[^a-zA-Z0-9一-龥]/g, '_') + '|';
		});

		return `${columnCount}-${contentHash}`;
	}

	private applyStoredWidths(table: HTMLTableElement) {
		const tableId = this.getTableIdentifier(table);
		const storedWidths = this.tableWidths.get(tableId);

		if (storedWidths && storedWidths.size > 0) {
			table.classList.add('table-resizer-fixed');
			storedWidths.forEach((width, columnIndex) => {
				this.applyColumnWidth(table, columnIndex, width);
			});
		}
	}

	private updateMarkdownTable(_table: HTMLTableElement) {
		// Widths are persisted to data.json via persistWidths() called by saveTableColumnWidth
		// This method kept for compatibility with handleMouseUp call chain
	}

	async loadSettings() {
		const data = (await this.loadData()) as StoredData | null;
		if (data?.tableWidths) {
			this.deserializeWidths(data.tableWidths);
			delete data.tableWidths;
		}
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
	}

	async saveSettings() {
		await this.saveData({
			...this.settings,
			tableWidths: this.serializeWidths()
		});
	}

	onunload() {
		// Clean up event listeners
		document.removeEventListener('mousemove', this.handleMouseMove);
		document.removeEventListener('mouseup', this.handleMouseUp);

		// Clean up MutationObservers
		this.mutationObservers.forEach((observer) => {
			observer.disconnect();
		});
		this.mutationObservers.clear();

		// Clear debounce timers
		this.mutationReapplyPending = false;
		if (this.keyupDebounceTimer !== null) {
			window.clearTimeout(this.keyupDebounceTimer);
			this.keyupDebounceTimer = null;
		}
		if (this.widthSaveTimer !== null) {
			window.clearTimeout(this.widthSaveTimer);
			this.widthSaveTimer = null;
		}

		// Remove all table resizers
		const tables = document.querySelectorAll('.table-resizer-active');
		tables.forEach(table => {
			this.disableResizing(table as HTMLTableElement);
		});

		// Clear saved widths
		if (this.tableWidths) {
			this.tableWidths.clear();
		}
	}

	private applyAllStoredWidths() {
		try {
			const tables = document.querySelectorAll('.table-resizer-active');

			if (tables.length === 0) {
				const allTables = document.querySelectorAll('table');

				// Try to match stored widths by identifier even for non-active tables
				allTables.forEach((table) => {
					const tableId = this.getTableIdentifier(table);
					if (this.tableWidths.has(tableId)) {
						this.enableResizing(table);
						this.applyStoredWidths(table);
					}
				});
				return;
			}

			tables.forEach((table) => {
				this.applyStoredWidths(table as HTMLTableElement);
			});
		} catch (error) {
			console.warn('Error applying stored widths:', error);
		}
	}
}
