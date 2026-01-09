
import { Component, ChangeDetectionStrategy, signal, computed, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

interface Sector {
  id: string;
  name: string;
  vatRate: number;
  pitRate: number;
}

type TabId = 'calc' | 'declare' | 'invoices' | 'quick-calc' | 'penalty' | 'accounting-book' | 'guide' | 'community' | 'integration-pos' | 'integration-sign' | 'integration-tax';
type BookId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7';

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  @ViewChild('chartContainer') chartContainer!: ElementRef;

  activeTab = signal<TabId>('calc');
  activeBook = signal<BookId | 'overview'>('overview');
  menuPosition = signal<'top' | 'left'>('left');
  showChat = signal(false);
  
  // Navigation States
  expandedMenus = signal<Record<string, boolean>>({ 'tools': true, 'accounting': true, 'integration': true });

  // Integration States
  posStatus = signal<Record<string, 'connected' | 'disconnected'>>({ 'KiotViet': 'disconnected', 'Sapo': 'connected' });
  einvoiceStatus = signal({
    provider: 'MISA meInvoice',
    remaining: 450,
    total: 500,
    expiry: '2027-12-31',
    tokenStatus: 'Active'
  });
  taxOfficeStatus = signal({
    connection: 'Stable',
    lastSync: '10:15 - Hôm nay',
    taxOffice: 'Chi cục Thuế Quận 1, TP.HCM'
  });

  // Accounting Data (Circular 88)
  s1Data = signal<any[]>([
    { id: 1, date: '2026-07-01', inv: 'HD001', dateInv: '2026-07-01', desc: 'Bán quần áo nam', rev010: 5000000, rev020: 0, rev030: 0, rev040: 0, total: 5000000 },
    { id: 2, date: '2026-07-02', inv: 'HD002', dateInv: '2026-07-02', desc: 'Dịch vụ may đo', rev010: 0, rev020: 1200000, rev030: 0, rev040: 0, total: 1200000 }
  ]);
  
  s2Data = signal<any[]>([
    { id: 1, item: 'Vải Cotton 100%', unit: 'Mét', code: 'VAT01', date: '2026-07-01', inQty: 100, inPrice: 50000, inTotal: 5000000, outQty: 20, outPrice: 50000, outTotal: 1000000, stockQty: 80, stockPrice: 50000, stockTotal: 4000000 }
  ]);

  s3Data = signal<any[]>([
    { id: 1, date: '2026-07-05', doc: 'PC012', desc: 'Mua vật liệu may mặc', total: 5000000, raw: 4500000, labor: 0, management: 500000 }
  ]);

  s4Data = signal<any[]>([
    { id: 1, date: '2026-04-15', doc: 'NT01', desc: 'Nộp thuế GTGT Quý 1/2026', type: 'GTGT', payable: 0, paid: 1500000, balance: 0 }
  ]);

  s5Data = signal<any[]>([
    { id: 1, date: '2026-07-31', name: 'Nguyễn Văn A', position: 'Nhân viên may', salary: 8500000, bonus: 500000, net: 9000000 }
  ]);

  s6Data = signal<any[]>([
    { id: 1, date: '2026-07-01', doc: 'PT001', desc: 'Thu tiền bán hàng HD001', income: 5000000, expense: 0, balance: 5000000 },
    { id: 2, date: '2026-07-05', doc: 'PC012', desc: 'Chi mua nguyên liệu', income: 0, expense: 5000000, balance: 0 }
  ]);

  s7Data = signal<any[]>([
    { id: 1, date: '2026-07-10', doc: 'GNT01', desc: 'Khách hàng chuyển khoản HD003', deposit: 2500000, withdraw: 0, balance: 2500000 }
  ]);

  // Tax Declaration State
  isDeclaring = signal(false);
  declareStep = signal(1);
  declarationRecords = signal<any[]>([
    { id: 'DK-2026-Q1', period: 'Quý 1/2026', type: 'Tờ khai chính thức', status: 'Submitted', date: '2026-04-15', totalTax: 2150000, deadline: '2026-04-30' },
    { id: 'DK-2026-Q2', period: 'Quý 2/2026', type: 'Tờ khai nháp', status: 'Draft', date: '-', totalTax: 0, deadline: '2026-07-30' }
  ]);

  // Sector Definitions
  sectors: Sector[] = [
    { id: '010', name: 'Phân phối, cung cấp hàng hóa', vatRate: 0.01, pitRate: 0.005 },
    { id: '020', name: 'Dịch vụ, xây dựng không bao thầu', vatRate: 0.05, pitRate: 0.02 },
    { id: '030', name: 'Sản xuất, vận tải, có bao thầu', vatRate: 0.03, pitRate: 0.015 },
    { id: '040', name: 'Cho thuê tài sản, đại lý, xổ số...', vatRate: 0.05, pitRate: 0.05 }
  ];

  declareSummary = computed(() => {
    const data = this.s1Data();
    const totals = {
      rev010: data.reduce((acc, curr) => acc + (curr.rev010 || 0), 0),
      rev020: data.reduce((acc, curr) => acc + (curr.rev020 || 0), 0),
      rev030: data.reduce((acc, curr) => acc + (curr.rev030 || 0), 0),
      rev040: data.reduce((acc, curr) => acc + (curr.rev040 || 0), 0),
    };

    const vat = (totals.rev010 * 0.01) + (totals.rev020 * 0.05) + (totals.rev030 * 0.03) + (totals.rev040 * 0.05);
    const pit = (totals.rev010 * 0.005) + (totals.rev020 * 0.02) + (totals.rev030 * 0.015) + (totals.rev040 * 0.05);
    const totalRev = totals.rev010 + totals.rev020 + totals.rev030 + totals.rev040;

    return {
      ...totals,
      totalRev,
      vat,
      pit,
      totalTax: vat + pit
    };
  });
  
  declareValidation = computed(() => {
      const summary = this.declareSummary();
      const warnings = [];
      if (summary.totalRev < 10000000) {
        warnings.push({
            sev: 'info',
            title: 'Doanh thu thấp hơn dự kiến',
            desc: 'Doanh thu kê khai thấp hơn mức trung bình của các kỳ trước. Vui lòng kiểm tra lại sổ S1.'
        });
      }
      if (summary.totalTax > 5000000) {
        warnings.push({
            sev: 'warning',
            title: 'Nghĩa vụ thuế cao',
            desc: 'Số thuế phải nộp cao bất thường. Đảm bảo rằng tất cả chi phí hợp lệ đã được ghi nhận.'
        });
      }
      return warnings;
  });

  // Quick Calc Widget State
  quickCalcVatRevenues = signal<{[key: string]: number}>({ 'rev10': 50000000, 'rev5': 20000000, 'rev0': 10000000 });
  quickCalcPitRevenue = signal<number>(80000000);
  quickCalcPitExpense = signal<number>(30000000);

  quickCalcResult = computed(() => {
    const vatRevs = this.quickCalcVatRevenues();
    const vat = (vatRevs['rev10'] * 0.10) + (vatRevs['rev5'] * 0.05);

    const pitRev = this.quickCalcPitRevenue();
    const pitExp = this.quickCalcPitExpense();
    const netIncome = Math.max(0, pitRev - pitExp);

    // Progressive tax calculation
    let pit = 0;
    if (netIncome > 0) {
        let taxable = netIncome;
        if (taxable > 160000000) { pit += (taxable - 160000000) * 0.35; taxable = 160000000; }
        if (taxable > 100000000) { pit += (taxable - 100000000) * 0.30; taxable = 100000000; }
        if (taxable > 60000000) { pit += (taxable - 60000000) * 0.25; taxable = 60000000; }
        if (taxable > 20000000) { pit += (taxable - 20000000) * 0.20; taxable = 20000000; }
        if (taxable > 10000000) { pit += (taxable - 10000000) * 0.15; taxable = 10000000; }
        if (taxable > 5000000) { pit += (taxable - 5000000) * 0.10; taxable = 5000000; }
        if (taxable > 0) { pit += taxable * 0.05; }
    }
    
    return { vat, pit, netIncome, totalTax: vat + pit };
  });

  // Penalty Tool
  penaltyDueDate = signal<string>('2026-07-31');
  penaltySubmitDate = signal<string>('2026-08-15');
  penaltyTaxAmount = signal<number>(5000000);

  penaltyResult = computed(() => {
    const due = new Date(this.penaltyDueDate());
    const sub = new Date(this.penaltySubmitDate());
    const diffDays = Math.ceil((sub.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return { days: 0, total: 0, fine: 0, lateInterest: 0, level: 'Đúng hạn' };
    
    let fine = 0;
    if (diffDays <= 30) fine = 3500000;
    else if (diffDays <= 60) fine = 6500000;
    else if (diffDays <= 90) fine = 11500000;
    else fine = 20000000;

    const lateInterest = this.penaltyTaxAmount() * diffDays * 0.0003;
    return { days: diffDays, total: fine + lateInterest, fine, lateInterest, level: diffDays > 90 ? 'Mức phạt cao nhất' : 'Vi phạm chậm nộp' };
  });

  // App General
  notifications = signal<any[]>([]);
  ocrLoading = signal(false);

  invoices = signal<any[]>([
    { id: 'INV-001', partner: 'Công ty May mặc VN', date: '2026-07-15', amount: 15000000, status: 'Verified' },
    { id: 'INV-002', partner: 'Khách hàng lẻ', date: '2026-07-16', amount: 2500000, status: 'Verified' }
  ]);

  chatMessages = signal<any[]>([{ sender: 'ai', text: 'Xin chào! Tôi là Trợ lý Thuế HKD. Bạn cần hỗ trợ gì về tích hợp hệ thống POS không?', time: '09:00' }]);

  monthlyData = signal([
    { month: 'T1', rev: 45000000 }, { month: 'T2', rev: 38000000 }, { month: 'T3', rev: 42000000 },
    { month: 'T4', rev: 55000000 }, { month: 'T5', rev: 61000000 }, { month: 'T6', rev: 58000000 },
    { month: 'T7', rev: 65000000 }
  ]);

  constructor() {
    effect(() => { if (this.activeTab() === 'calc') setTimeout(() => this.renderChart(), 100); });
  }

  notify(type: 'success' | 'error' | 'info', message: string) {
    const id = Date.now().toString();
    this.notifications.update(prev => [...prev, { id, type, message }]);
    setTimeout(() => this.notifications.update(prev => prev.filter(n => n.id !== id)), 4000);
  }

  toggleSubMenu(menuId: string, event: Event) {
    event.stopPropagation();
    this.expandedMenus.update(prev => ({ ...prev, [menuId]: !prev[menuId] }));
  }

  selectTab(tabId: TabId) {
    this.activeTab.set(tabId);
    if (!tabId.startsWith('declare')) this.isDeclaring.set(false);
  }

  isParentActive(menuId: string): boolean {
    const current = this.activeTab();
    if (menuId === 'tools') return current === 'quick-calc' || current === 'penalty';
    if (menuId === 'accounting') return current === 'accounting-book';
    if (menuId === 'integration') return current.startsWith('integration');
    return false;
  }

  renderChart() {
    if (!this.chartContainer) return;
    const data = this.monthlyData();
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll('svg').remove();
    const margin = { top: 30, right: 30, bottom: 40, left: 70 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;
    const svg = d3.select(element).append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom).append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3.scalePoint().range([0, width]).domain(data.map(d => d.month)).padding(0.6);
    const y = d3.scaleLinear().range([height, 0]).domain([0, d3.max(data, d => d.rev)! * 1.2]).nice();
    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x)).attr('color', '#999');
    svg.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => (Number(d) / 1000000) + 'M')).attr('color', '#999');
    const line = d3.line<any>().x(d => x(d.month)!).y(d => y(d.rev)).curve(d3.curveMonotoneX);
    svg.append('path').datum(data).attr('fill', 'none').attr('stroke', '#000').attr('stroke-width', 3).attr('d', line);
  }

  toggleIntegration(partner: string) {
    this.posStatus.update(prev => ({
      ...prev,
      [partner]: prev[partner] === 'connected' ? 'disconnected' : 'connected'
    }));
    const status = this.posStatus()[partner];
    this.notify(status === 'connected' ? 'success' : 'info', `Đã ${status === 'connected' ? 'kết nối' : 'ngắt kết nối'} thành công với ${partner}.`);
  }

  syncTaxData() {
    this.notify('info', 'Đang đồng bộ dữ liệu với Tổng cục Thuế...');
    setTimeout(() => {
      this.taxOfficeStatus.update(prev => ({ ...prev, lastSync: 'Vừa xong' }));
      this.notify('success', 'Đồng bộ hoàn tất. Không có thông báo mới từ Chi cục Thuế.');
    }, 2000);
  }

  exportBook(bookId: string) { this.notify('success', `Kết xuất Sổ ${bookId} thành công.`); }
  
  addEntry(bookId: string) {
    this.notify('info', `Vui lòng nhập liệu vào bảng cho Sổ ${bookId}.`);
    const now = new Date().toISOString().split('T')[0];
    if (bookId === 'S1') {
      const newEntry = { id: Date.now(), date: now, inv: 'HD-NEW', dateInv: now, desc: 'Giao dịch mới', rev010: 1000000, rev020: 0, rev030: 0, rev040: 0, total: 1000000 };
      this.s1Data.update(prev => [...prev, newEntry]);
    } else if (bookId === 'S3') {
      this.s3Data.update(prev => [...prev, { id: Date.now(), date: now, doc: 'PC-NEW', desc: 'Chi phí mới', total: 500000, raw: 500000, labor: 0, management: 0 }]);
    } else if (bookId === 'S4') {
      this.s4Data.update(prev => [...prev, { id: Date.now(), date: now, doc: 'NT-NEW', desc: 'Giao dịch thuế', type: 'GTGT', payable: 0, paid: 500000, balance: 0 }]);
    } else if (bookId === 'S5') {
      this.s5Data.update(prev => [...prev, { id: Date.now(), date: now, name: 'Nhân viên mới', position: 'Vị trí', salary: 0, bonus: 0, net: 0 }]);
    } else if (bookId === 'S7') {
      this.s7Data.update(prev => [...prev, { id: Date.now(), date: now, doc: 'UNC-NEW', desc: 'Giao dịch ngân hàng', deposit: 0, withdraw: 0, balance: 0 }]);
    }
  }

  deleteEntry(bookId: string, id: any) {
    if (confirm('Xác nhận xóa?')) {
      if (bookId === 'S1') this.s1Data.update(prev => prev.filter(r => r.id !== id));
      if (bookId === 'S2') this.s2Data.update(prev => prev.filter(r => r.id !== id));
      if (bookId === 'S3') this.s3Data.update(prev => prev.filter(r => r.id !== id));
      if (bookId === 'S4') this.s4Data.update(prev => prev.filter(r => r.id !== id));
      if (bookId === 'S5') this.s5Data.update(prev => prev.filter(r => r.id !== id));
      if (bookId === 'S6') this.s6Data.update(prev => prev.filter(r => r.id !== id));
      if (bookId === 'S7') this.s7Data.update(prev => prev.filter(r => r.id !== id));
      if (bookId === 'INV') this.invoices.update(prev => prev.filter(inv => inv.id !== id));
      this.notify('success', 'Đã xóa thành công.');
    }
  }

  startDeclaration() { this.isDeclaring.set(true); this.declareStep.set(1); this.notify('info', 'Đang thiết lập tờ khai từ sổ kế toán...'); }
  
  submitDeclaration() {
    this.notify('success', 'Đã nộp tờ khai thành công!');
    this.isDeclaring.set(false);
    this.declarationRecords.update(prev => [{ id: 'DK-2026-Q2', period: 'Quý 2/2026', type: 'Tờ khai chính thức', status: 'Submitted', date: 'Vừa xong', totalTax: this.declareSummary().totalTax, deadline: '2026-07-30' }, ...prev.filter(r => r.id !== 'DK-2026-Q2')]);
  }

  exportFile(type: 'PDF' | 'XML' | 'Excel') { this.notify('success', `Đã kết xuất tệp ${type} tờ khai chuẩn.`); }
  
  updateQuickCalcVatRevenue(key: 'rev10' | 'rev5' | 'rev0', event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.quickCalcVatRevenues.update(s => ({
      ...s,
      [key]: +value
    }));
  }

  simulateOCR() {
    this.ocrLoading.set(true);
    this.notify('info', 'AI đang quét hóa đơn...');
    setTimeout(() => {
      this.ocrLoading.set(false);
      this.notify('success', 'Đã quét hóa đơn!');
      this.invoices.update(prev => [{ id: `INV-${Math.floor(Math.random() * 999)}`, partner: 'Cửa hàng AI', date: '2026-07-25', amount: 450000, status: 'Verified' }, ...prev]);
    }, 1500);
  }

  userMsg = signal('');
  sendMsg() {
    if (!this.userMsg().trim()) return;
    this.chatMessages.update(prev => [...prev, { sender: 'user', text: this.userMsg(), time: 'Now' }]);
    this.userMsg.set('');
    setTimeout(() => this.chatMessages.update(prev => [...prev, { sender: 'ai', text: 'Tôi đang kiểm tra trạng thái tích hợp của bạn...', time: 'Now' }]), 800);
  }
}
