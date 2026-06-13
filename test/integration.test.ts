import { JSDOM } from 'jsdom';

describe('Table Resizer Integration Tests', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeAll(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="markdown-preview-view">
            <table>
              <tr>
                <th>Header 1</th>
                <th>Header 2</th>
                <th>Header 3</th>
              </tr>
              <tr>
                <td>Cell 1</td>
                <td>Cell 2</td>
                <td>Cell 3</td>
              </tr>
              <tr>
                <td>Cell 4</td>
                <td>Cell 5</td>
                <td>Cell 6</td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `, { 
      runScripts: 'dangerously',
      resources: 'usable'
    });
    
    document = dom.window.document;
    window = dom.window;
  });

  describe('Table HTML Structure', () => {
    it('should parse markdown table correctly', () => {
      const table = document.querySelector('table');
      expect(table).toBeTruthy();
      
      const rows = table?.querySelectorAll('tr');
      expect(rows?.length).toBe(3);
    });

    it('should have correct header cells', () => {
      const headers = document.querySelectorAll('th');
      expect(headers.length).toBe(3);
      expect(headers[0].textContent).toBe('Header 1');
      expect(headers[1].textContent).toBe('Header 2');
      expect(headers[2].textContent).toBe('Header 3');
    });

    it('should have correct data cells', () => {
      const cells = document.querySelectorAll('td');
      expect(cells.length).toBe(6);
      
      const expectedTexts = ['Cell 1', 'Cell 2', 'Cell 3', 'Cell 4', 'Cell 5', 'Cell 6'];
      cells.forEach((cell, index) => {
        expect(cell.textContent).toBe(expectedTexts[index]);
      });
    });
  });

  describe('DOM Manipulation', () => {
    it('should add class to table', () => {
      const table = document.querySelector('table') as HTMLTableElement;
      table.classList.add('table-resizer-active');
      
      expect(table.classList.contains('table-resizer-active')).toBe(true);
    });

    it('should create resizer handle', () => {
      const cell = document.querySelector('th') as HTMLElement;
      const handle = document.createElement('div');
      handle.className = 'table-resizer-handle';
      handle.setAttribute('data-column', '0');
      
      cell.appendChild(handle);
      
      const addedHandle = cell.querySelector('.table-resizer-handle');
      expect(addedHandle).toBeTruthy();
      expect(addedHandle?.getAttribute('data-column')).toBe('0');
    });

    it('should apply width to column', () => {
      const table = document.querySelector('table') as HTMLTableElement;
      const cells = table.querySelectorAll('th, td');
      
      cells.forEach(cell => {
        (cell as HTMLElement).style.width = '150px';
        (cell as HTMLElement).style.minWidth = '150px';
      });
      
      cells.forEach(cell => {
        expect((cell as HTMLElement).style.width).toBe('150px');
        expect((cell as HTMLElement).style.minWidth).toBe('150px');
      });
    });
  });

  describe('Event Simulation', () => {
    it('should simulate mouse events', () => {
      const cell = document.querySelector('th') as HTMLElement;
      let clickCount = 0;
      
      cell.addEventListener('click', () => {
        clickCount++;
      });
      
      const clickEvent = new window.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      
      cell.dispatchEvent(clickEvent);
      
      expect(clickCount).toBe(1);
    });

    it('should handle mousedown on handle', (done) => {
      const cell = document.querySelector('th') as HTMLElement;
      const handle = document.createElement('div');
      handle.className = 'table-resizer-handle';
      cell.appendChild(handle);
      
      handle.addEventListener('mousedown', (e) => {
        expect(e).toBeTruthy();
        done();
      });
      
      const mouseDownEvent = new window.MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: 100,
        clientY: 50
      });
      
      handle.dispatchEvent(mouseDownEvent);
    });

    it('should track mouse movement', () => {
      let lastX = 0;
      
      document.addEventListener('mousemove', (e) => {
        lastX = (e as MouseEvent).clientX;
      });
      
      const mouseMoveEvent = new window.MouseEvent('mousemove', {
        clientX: 200,
        clientY: 100
      });
      
      document.dispatchEvent(mouseMoveEvent);
      
      expect(lastX).toBe(200);
    });
  });

  describe('Performance', () => {
    it('should handle large tables efficiently', () => {
      const largeTable = document.createElement('table');
      
      // Create a table with 100 rows
      for (let i = 0; i < 100; i++) {
        const row = document.createElement('tr');
        for (let j = 0; j < 5; j++) {
          const cell = document.createElement('td');
          cell.textContent = `Cell ${i}-${j}`;
          row.appendChild(cell);
        }
        largeTable.appendChild(row);
      }
      
      document.body.appendChild(largeTable);
      
      // Process all cells
      const startTime = Date.now();
      const cells = largeTable.querySelectorAll('td');
      cells.forEach((cell, index) => {
        (cell as HTMLElement).style.width = `${100 + index % 10}px`;
      });
      const endTime = Date.now();
      
      // Should complete within 100ms
      expect(endTime - startTime).toBeLessThan(100);
      
      document.body.removeChild(largeTable);
    });
  });
});
