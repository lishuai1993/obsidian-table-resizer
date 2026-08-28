import { Plugin, MarkdownView, Notice } from 'obsidian';

// 调试开关：需要排查问题时改为 true 即可恢复日志输出
const DEBUG_LOGGING = false;

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

	private log(message: string, data?: unknown) {
		if (!DEBUG_LOGGING) return;
		const ts = new Date().toISOString().substring(11, 23);
		const prefix = `[TableResizer ${ts}]`;
		if (data !== undefined) {
			console.log(`${prefix} ${message}`, data);
		} else {
			console.log(`${prefix} ${message}`);
		}
	}

	async onload() {
		this.log('Plugin loading...');

		try {
			this.settings = Object.assign({}, DEFAULT_SETTINGS);

			await this.loadSettings();
			this.log('Settings loaded', this.settings);

			this.registerStyleSheet();
			this.log('Styles registered');

			this.registerEvent(
				this.app.workspace.on('layout-change', () => {
					this.log('Event: layout-change');
					this.dumpTableState('layout-change (before init)');
					this.initTables();
					setTimeout(() => {
						this.applyAllStoredWidths();
						this.dumpTableState('layout-change (after apply)');
					}, 100);
				})
			);

			this.registerEvent(
				this.app.workspace.on('active-leaf-change', () => {
					this.log('Event: active-leaf-change');
					this.dumpTableState('active-leaf-change (before init)');
					this.initTables();
					setTimeout(() => {
						this.applyAllStoredWidths();
						this.dumpTableState('active-leaf-change (after apply)');
					}, 100);
				})
			);

			this.registerEvent(
				this.app.workspace.on('file-open', () => {
					this.log('Event: file-open');
					this.dumpTableState('file-open (before init)');
					setTimeout(() => {
						this.initTables();
						this.applyAllStoredWidths();
						this.dumpTableState('file-open (after apply)');
					}, 200);
				})
			);

			// keyup listener: detect new tables created by typing in Live Preview
			// CM6 may defer table widget rendering, so keyup + periodic scan are needed
			this.registerDomEvent(document, 'keyup', () => {
				if (this.keyupDebounceTimer !== null) {
					clearTimeout(this.keyupDebounceTimer);
				}
				this.keyupDebounceTimer = window.setTimeout(() => {
					this.keyupDebounceTimer = null;
					this.log('keyup scan: checking for new tables');
					this.initTables();
					requestAnimationFrame(() => {
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
			this.log('keyup listener + periodic scan registered');

			this.addCommand({
				id: 'toggle-table-resizer',
				name: 'Toggle table resizer',
				callback: () => {
					this.settings.enableResizer = !this.settings.enableResizer;
					this.saveSettings();
					new Notice(`Table resizer ${this.settings.enableResizer ? 'enabled' : 'disabled'}`);
					this.initTables();
				}
			});

			if ((this.app.workspace as any).onReady) {
				(this.app.workspace as any).onReady(() => {
					setTimeout(() => {
						try {
							this.log('onReady: initializing tables');
							this.dumpTableState('onReady (before init)');
							this.initTables();
							this.applyAllStoredWidths();
							this.dumpTableState('onReady (after init)');
							this.log('Tables initialized (onReady)');
						} catch (err) {
							if (DEBUG_LOGGING) console.warn('Error initializing tables:', err);
						}
					}, 100);
				});
			} else {
				setTimeout(() => {
					try {
						this.log('fallback: initializing tables');
						this.dumpTableState('fallback (before init)');
						this.initTables();
						this.applyAllStoredWidths();
						this.dumpTableState('fallback (after init)');
						this.log('Tables initialized (fallback)');
					} catch (err) {
						if (DEBUG_LOGGING) console.warn('Error initializing tables:', err);
					}
				}, 500);
			}

			this.log('Plugin loaded successfully');
		} catch (error) {
			console.error('Failed to load Table Resizer plugin:', error);
		}
	}

	private registerStyleSheet() {
		try {
			if (document.getElementById('table-resizer-styles')) {
				return;
			}

			const style = document.createElement('style');
			style.id = 'table-resizer-styles';
			style.textContent = `
				.table-resizer-handle {
					position: absolute;
					top: 0;
					right: -2px;
					width: 5px;
					height: 100%;
					cursor: col-resize;
					user-select: none;
					z-index: 100;
					opacity: 0;
					transition: opacity 0.2s;
				}

				.table-resizer-handle:hover,
				.table-resizer-handle.dragging {
					background-color: var(--interactive-accent, #7f6df2);
					opacity: 0.5;
				}

				.table-resizer-active td,
				.table-resizer-active th {
					position: relative;
					height: auto;
				}

				/* Prevent empty cells from collapsing — min-height is unreliable on table-cell */
				.table-resizer-active td:empty::after,
				.table-resizer-active th:empty::after {
					content: '\\00a0';
					display: inline-block;
					line-height: 1.8;
				}

				.table-resizer-active tr {
					height: auto;
				}

				.table-resizer-dragging * {
					cursor: col-resize !important;
					user-select: none !important;
				}
			`;

			if (document.head) {
				document.head.appendChild(style);
			} else {
				document.documentElement.appendChild(style);
			}
		} catch (error) {
			if (DEBUG_LOGGING) console.error('Error registering stylesheet:', error);
		}
	}

	private initTables() {
		try {
			const markdownViews = this.app.workspace.getLeavesOfType('markdown');

			if (!markdownViews || markdownViews.length === 0) {
				this.log('initTables: no markdown views found');
				return;
			}

			this.log(`initTables: processing ${markdownViews.length} markdown view(s)`);

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
						this.log('Found preview element, processing tables...');
						this.processTables(previewEl as HTMLElement);
					}

					// Editing View (Live Preview)
					const sourceEl = view.contentEl.querySelector('.markdown-source-view') ||
						view.contentEl.querySelector('.cm-content') ||
						view.contentEl.querySelector('.CodeMirror-code');

					if (sourceEl) {
						this.log('Found source/edit element, processing tables...');
						this.processTables(sourceEl as HTMLElement);
					}

					if (!previewEl && !sourceEl) {
						this.log('No specific view element found, searching in contentEl...');
						this.processTables(view.contentEl);
					}
				} catch (error) {
					if (DEBUG_LOGGING) console.warn('Error processing view:', error);
				}
			});
		} catch (error) {
			if (DEBUG_LOGGING) console.error('Error in initTables:', error);
		}
	}

	private setupMutationObserver(container: HTMLElement) {
		// Skip if already observing this container
		if (this.mutationObservers.has(container)) {
			return;
		}

		this.log('MutationObserver: setting up on', container.className || container.tagName);

		let mutationCount = 0;
		const observer = new MutationObserver((mutations) => {
			mutationCount++;
			// Skip if we're the ones making changes
			if (this.isApplyingWidths) {
				return;
			}

			let tableRelated = false;
			let triggerReason = '';

			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					for (const node of mutation.addedNodes) {
						if (node instanceof HTMLElement) {
							if (node.tagName === 'TABLE') {
								tableRelated = true;
								triggerReason = `TABLE added (${(node as HTMLTableElement).rows?.length || 0} rows)`;
								break;
							}
							if (node.querySelector('table')) {
								tableRelated = true;
								triggerReason = 'node containing TABLE added';
								break;
							}
						}
					}
					if (!tableRelated) {
						for (const node of mutation.removedNodes) {
							if (node instanceof HTMLElement) {
								if (node.tagName === 'TABLE' || node.querySelector('table')) {
									tableRelated = true;
									triggerReason = 'TABLE removed';
									break;
								}
							}
						}
					}
					if (!tableRelated && mutation.target instanceof HTMLElement) {
						const closestTable = mutation.target.closest('table');
						if (closestTable) {
							tableRelated = true;
							const targetDesc = mutation.target.tagName || mutation.target.nodeName;
							triggerReason = `DOM change inside table (target: ${targetDesc}, added: ${mutation.addedNodes.length}, removed: ${mutation.removedNodes.length})`;
						}
					}
				} else if (mutation.type === 'characterData') {
					if (mutation.target instanceof Node && mutation.target.parentElement) {
						const closestTable = mutation.target.parentElement.closest('table');
						if (closestTable) {
							tableRelated = true;
							triggerReason = `characterData change inside table`;
						}
					}
				}
				if (tableRelated) break;
			}

			if (tableRelated) {
				this.log(`MutationObserver [#${mutationCount}]: ${triggerReason}`);
				this.scheduleMutationReapply();
			}
		});

		observer.observe(container, {
			childList: true,
			subtree: true,
			characterData: true,
		});

		this.mutationObservers.set(container, observer);
		this.log('MutationObserver: registered successfully');
	}

	private scheduleMutationReapply() {
		if (this.mutationReapplyPending) return;
		this.mutationReapplyPending = true;
		// CM6 renders synchronously — queueMicrotask is fast enough to avoid visible flicker
		queueMicrotask(() => {
			this.mutationReapplyPending = false;
			this.log('MutationObserver: re-initializing tables');
			this.dumpTableState('before mutation reapply');
			this.initTables();
			// Two rAF rounds to guard against any async re-renders
			requestAnimationFrame(() => {
				this.applyAllStoredWidths();
				requestAnimationFrame(() => {
					this.applyAllStoredWidths();
					this.dumpTableState('after mutation reapply (2x rAF)');
				});
			});
		});
	}

	private processTables(container: HTMLElement) {
		const tables = container.querySelectorAll('table');
		this.log(`processTables: found ${tables.length} table(s) in container`);

		tables.forEach((table, idx) => {
			if (this.settings.enableResizer) {
				this.enableResizing(table as HTMLTableElement);
				this.applyStoredWidths(table as HTMLTableElement);
			} else {
				this.disableResizing(table as HTMLTableElement);
			}
		});
	}

	private enableResizing(table: HTMLTableElement) {
		const hadClass = table.classList.contains('table-resizer-active');

		table.classList.add('table-resizer-active');

		const rows = table.querySelectorAll('tr');
		if (!rows || rows.length === 0) {
			this.log('enableResizing: table has no rows, skipping');
			return;
		}

		const firstRow = rows[0];
		const columnCount = firstRow.querySelectorAll('th, td').length;
		const totalCells = Array.from(rows).reduce((sum, row) => sum + row.querySelectorAll('th, td').length, 0);
		const existingHandles = table.querySelectorAll('.table-resizer-handle').length;

		if (hadClass && existingHandles >= totalCells) {
			this.log(`enableResizing: already active with ${existingHandles} handles, skipping`);
			return;
		}

		if (hadClass && existingHandles < totalCells) {
			this.log(`enableResizing: handles missing (${existingHandles}/${totalCells}), re-adding`);
		} else {
			this.log(`enableResizing: table ${rows.length}x${columnCount}, adding handles`);
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
				// Prevent empty cells from collapsing (min-height on table-cell is unreliable per CSS spec)
				if (el.textContent?.trim() === '') {
					el.style.minHeight = '1.8em';
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
		(table as HTMLElement).style.tableLayout = '';
		const handles = table.querySelectorAll('.table-resizer-handle');
		handles.forEach(handle => handle.remove());
	}

	private addResizerHandle(cell: HTMLElement, table: HTMLTableElement, columnIndex: number) {
		if (cell.querySelector('.table-resizer-handle')) {
			return;
		}

		const handle = document.createElement('div');
		handle.className = 'table-resizer-handle';
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

		cell.appendChild(handle);
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

		this.log(`startDrag: column=${columnIndex}, startWidth=${this.startWidth}px, clientX=${e.clientX}`);

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

		this.log(`handleMouseUp: drag ended, column=${draggedColumn}`);

		// Multi-round rAF to confirm width sticks against CM6 async re-renders
		if (draggedTable && draggedColumn >= 0) {
			const tableId = this.getTableIdentifier(draggedTable);
			const storedWidths = this.tableWidths.get(tableId);
			const expectedWidth = storedWidths?.get(draggedColumn);
			if (expectedWidth) {
				// Round 1
				requestAnimationFrame(() => {
					this.confirmColumnWidth(draggedTable, draggedColumn, expectedWidth, 1);
					// Round 2
					requestAnimationFrame(() => {
						this.confirmColumnWidth(draggedTable, draggedColumn, expectedWidth, 2);
						// Round 3
						setTimeout(() => {
							this.confirmColumnWidth(draggedTable!, draggedColumn, expectedWidth, 3);
							this.dumpTableState('after drag (3 confirmations)');
						}, 100);
					});
				});
			}
		}

		this.currentTable = null;
		this.currentColumn = -1;
	}

	private confirmColumnWidth(table: HTMLTableElement, columnIndex: number, expectedWidth: number, round: number) {
		const firstRow = table.querySelector('tr');
		if (!firstRow) return;
		const cell = firstRow.querySelectorAll('th, td')[columnIndex] as HTMLElement;
		if (!cell) return;
		const currentWidth = cell.style.width;
		if (currentWidth !== `${expectedWidth}px`) {
			this.log(`confirmColumnWidth round#${round}: width mismatch (expected=${expectedWidth}px, actual=${currentWidth}), re-applying`);
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
		const tableId = this.getTableIdentifier(table);

		this.log(`applyColumnWidth: table=${tableId}, col=${columnIndex}, width=${width}px, rows=${rows.length}`);

		// Force table-layout:fixed so the browser respects explicit column widths
		(table as HTMLElement).style.tableLayout = 'fixed';

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
		requestAnimationFrame(() => {
			const rowsNow = table.querySelectorAll('tr');
			rowsNow.forEach(row => {
				const cells = row.querySelectorAll('th, td');
				if (cells[columnIndex]) {
					const cell = cells[columnIndex] as HTMLElement;
					if (cell.style.width !== `${width}px`) {
						this.log(`applyColumnWidth: width was overwritten for col=${columnIndex}, re-applying (rAF)`);
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
		this.log(`saveTableColumnWidth: table=${tableId}, col=${columnIndex}, width=${width}px, total stored: ${this.tableWidths.size} tables`);
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
		this.log(`deserializeWidths: restored ${this.tableWidths.size} table(s)`);
	}

	private persistWidths() {
		if (this.widthSaveTimer !== null) {
			clearTimeout(this.widthSaveTimer);
		}
		this.widthSaveTimer = window.setTimeout(() => {
			this.widthSaveTimer = null;
			this.saveSettings();
			this.log('persistWidths: saved to disk');
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
		} catch (error) {
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

		this.log(`applyStoredWidths: table=${tableId}, hasWidths=${!!storedWidths}, count=${storedWidths?.size || 0}`);

		if (storedWidths && storedWidths.size > 0) {
			(table as HTMLElement).style.tableLayout = 'fixed';
			storedWidths.forEach((width, columnIndex) => {
				this.log(`  restoring col=${columnIndex} -> ${width}px`);
				this.applyColumnWidth(table, columnIndex, width);
			});
		}
	}

	private updateMarkdownTable(_table: HTMLTableElement) {
		// Widths are persisted to data.json via persistWidths() called by saveTableColumnWidth
		// This method kept for compatibility with handleMouseUp call chain
	}

	async loadSettings() {
		const data = await this.loadData();
		if (data?.tableWidths) {
			this.deserializeWidths(data.tableWidths);
			delete data.tableWidths;
		}
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings() {
		await this.saveData({
			...this.settings,
			tableWidths: this.serializeWidths()
		});
	}

	onunload() {
		this.log('Plugin unloading...');

		// Clean up event listeners
		document.removeEventListener('mousemove', this.handleMouseMove);
		document.removeEventListener('mouseup', this.handleMouseUp);

		// Clean up MutationObservers
		this.mutationObservers.forEach((observer) => {
			observer.disconnect();
		});
		this.mutationObservers.clear();
		this.log('MutationObservers disconnected');

		// Clear debounce timers
		this.mutationReapplyPending = false;
		if (this.keyupDebounceTimer !== null) {
			clearTimeout(this.keyupDebounceTimer);
			this.keyupDebounceTimer = null;
		}
		if (this.widthSaveTimer !== null) {
			clearTimeout(this.widthSaveTimer);
			this.widthSaveTimer = null;
		}

		// Remove styles
		const style = document.getElementById('table-resizer-styles');
		if (style) {
			style.remove();
		}

		// Remove all table resizers
		const tables = document.querySelectorAll('.table-resizer-active');
		tables.forEach(table => {
			(table as HTMLElement).style.tableLayout = '';
			this.disableResizing(table as HTMLTableElement);
		});

		// Clear saved widths
		if (this.tableWidths) {
			this.tableWidths.clear();
		}

		this.log('Plugin unloaded');
	}

	private dumpTableState(reason: string) {
		this.log(`=== STATE DUMP: ${reason} ===`);
		const allTables = document.querySelectorAll('table');
		this.log(`  Total tables in DOM: ${allTables.length}`);
		allTables.forEach((t, i) => {
			const htmlTable = t as HTMLTableElement;
			const tableId = this.getTableIdentifier(htmlTable);
			const rows = htmlTable.querySelectorAll('tr');
			const colCount = rows.length > 0 ? rows[0].querySelectorAll('th, td').length : 0;
			const hasClass = htmlTable.classList.contains('table-resizer-active');
			const handleCount = htmlTable.querySelectorAll('.table-resizer-handle').length;
			const stored = this.tableWidths.get(tableId);
			const storedInfo = stored ? Array.from(stored.entries()).map(([c, w]) => `c${c}=${w}px`).join(',') : 'none';
			// Get actual DOM widths of first row
			const domWidths: string[] = [];
			if (rows.length > 0) {
				rows[0].querySelectorAll('th, td').forEach((cell) => {
					domWidths.push(`${(cell as HTMLElement).style.width || 'auto'}`);
				});
			}
			const tableLayout = (htmlTable as HTMLElement).style.tableLayout || 'auto';
			this.log(`  Table#${i}: id=${tableId}, ${rows.length}x${colCount}, active=${hasClass}, handles=${handleCount}, layout=${tableLayout}, domWidths=[${domWidths.join(',')}], stored=[${storedInfo}]`);
		});
		this.log(`  Stored tableWidths in memory: ${this.tableWidths.size} entries`);
		this.tableWidths.forEach((cols, tid) => {
			this.log(`    ${tid}: [${Array.from(cols.entries()).map(([c,w]) => `c${c}=${w}px`).join(', ')}]`);
		});
		// Cursor position
		try {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view && (view as any).editor) {
				const cursor = (view as any).editor.getCursor();
				this.log(`  Cursor: line=${cursor?.line}, ch=${cursor?.ch}`);
			}
		} catch (e) { /* ignore */ }
		this.log(`=== STATE DUMP END ===`);
	}

	private applyAllStoredWidths() {
		try {
			const tables = document.querySelectorAll('.table-resizer-active');
			this.log(`applyAllStoredWidths: ${tables.length} active table(s)`);

			if (tables.length === 0) {
				this.log('applyAllStoredWidths: no active tables, checking all tables...');
				const allTables = document.querySelectorAll('table');
				this.log(`applyAllStoredWidths: found ${allTables.length} total table(s) in document`);

				// Try to match stored widths by identifier even for non-active tables
				allTables.forEach((table) => {
					const htmlTable = table as HTMLTableElement;
					const tableId = this.getTableIdentifier(htmlTable);
					if (this.tableWidths.has(tableId)) {
						this.log(`applyAllStoredWidths: matched non-active table ${tableId}, applying`);
						this.enableResizing(htmlTable);
						this.applyStoredWidths(htmlTable);
					}
				});
				return;
			}

			tables.forEach((table, index) => {
				const htmlTable = table as HTMLTableElement;
				this.log(`applyAllStoredWidths: processing table ${index}`);
				this.applyStoredWidths(htmlTable);
			});
		} catch (error) {
			if (DEBUG_LOGGING) console.warn('Error applying stored widths:', error);
		}
	}
}
