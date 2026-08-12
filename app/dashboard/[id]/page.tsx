'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  BarChart3, Settings, Edit3, Trash2, ArrowLeft, 
  ExternalLink, Layers, RefreshCw, PieChart, TrendingUp,
  FileText, Briefcase, Landmark, HelpCircle, Store, BookOpen,
  Building2, Users, ShoppingBag, Pencil
} from 'lucide-react';

export default function DashboardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dashboardId = params.id as string;

  const [dashboard, setDashboard] = useState<any>(null);
  const [metricLinks, setMetricLinks] = useState<Record<string, string>>({});
  const [kpiBusiness, setKpiBusiness] = useState<any>(null);
  const [kpiProducts, setKpiProducts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Popup 1: Cài Link (Icon ⚙️)
  const [settingMetric, setSettingMetric] = useState<{ key: string; label: string } | null>(null);
  const [targetUrlInput, setTargetUrlInput] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  // Popup 2: Nhập số liệu trực tiếp (Icon ✏️ bên phải)
  const [inputtingMetric, setInputtingMetric] = useState<{
    key: string;
    label: string;
    section: 'B1' | 'B2';
    field: string;
    currentValue: number;
  } | null>(null);
  const [newValueInput, setNewValueInput] = useState<number | string>(0);
  const [savingValue, setSavingValue] = useState(false);

  // Popup 3: Thiết lập ID B1 / B2
  const [settingSection, setSettingSection] = useState<'B1' | 'B2' | null>(null);
  const [customIdInput, setCustomIdInput] = useState('');
  const [savingSectionId, setSavingSectionId] = useState(false);

  // Popup 4: Sửa thông tin Dashboard
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDomain, setEditDomain] = useState('');

  // 1. Tải thông số Dashboard
  const fetchDashboardDetail = async () => {
    setLoading(true);
    
    const { data: dash } = await supabase
      .from('dashboards')
      .select('*, unit:administrative_units(*)')
      .eq('id', dashboardId)
      .single();

    if (dash) {
      setDashboard(dash);
      setEditTitle(dash.title);
      setEditDomain(dash.domain_link || '');

      // Tải danh sách link
      const { data: links } = await supabase
        .from('metric_links')
        .select('*')
        .eq('dashboard_id', dashboardId);

      if (links) {
        const linkMap: Record<string, string> = {};
        links.forEach((l) => (linkMap[l.metric_key] = l.target_url));
        setMetricLinks(linkMap);
      }

      // Tải số liệu B1
      const { data: b1 } = await supabase
        .from('kpi_business_units')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setKpiBusiness(b1 || {});

      // Tải số liệu B2
      const { data: b2 } = await supabase
        .from('kpi_products')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setKpiProducts(b2 || {});
    }

    setLoading(false);
  };

  useEffect(() => {
    if (dashboardId) fetchDashboardDetail();
  }, [dashboardId]);

  // CHUYỂN HƯỚNG TRỰC TIẾP KHI CLICK VÀO THẺ
  const handleMetricClick = (metricKey: string, metricLabel: string) => {
    const url = metricLinks[metricKey];
    if (url && url.trim() !== '') {
      const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
      window.open(formattedUrl, '_blank');
    } else {
      openSetLinkModal(metricKey, metricLabel);
    }
  };

  // MỞ POPUP 1: CÀI LINK ⚙️
  const openSetLinkModal = (metricKey: string, metricLabel: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSettingMetric({ key: metricKey, label: metricLabel });
    setTargetUrlInput(metricLinks[metricKey] || '');
  };

  // LƯU LINK ⚙️
  const handleSaveMetricLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingMetric) return;

    setSavingLink(true);
    try {
      const res = await fetch('/api/v1/metrics/set-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboardId,
          metricKey: settingMetric.key,
          targetUrl: targetUrlInput,
        }),
      });

      if (res.ok) {
        setMetricLinks((prev) => ({ ...prev, [settingMetric.key]: targetUrlInput }));
        setSettingMetric(null);
      } else {
        alert('Lỗi lưu liên kết!');
      }
    } catch (err: any) {
      alert('Lỗi kết nối API: ' + err.message);
    } finally {
      setSavingLink(false);
    }
  };

  // MỞ POPUP 2: NHẬP SỐ LIỆU ✏️
  const openInputValueModal = (
    key: string,
    label: string,
    section: 'B1' | 'B2',
    field: string,
    currentValue: number,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setInputtingMetric({ key, label, section, field, currentValue });
    setNewValueInput(currentValue || 0);
  };

  // LƯU SỐ LIỆU ✏️
  const handleSaveMetricValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputtingMetric) return;

    setSavingValue(true);
    try {
      const res = await fetch('/api/v1/metrics/update-value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboardId,
          section: inputtingMetric.section,
          field: inputtingMetric.field,
          value: Number(newValueInput) || 0,
        }),
      });

      if (res.ok) {
        setInputtingMetric(null);
        fetchDashboardDetail(); // Tải lại dữ liệu ngay lập tức
      } else {
        const errData = await res.json();
        alert('Lỗi cập nhật: ' + errData.error);
      }
    } catch (err: any) {
      alert('Lỗi kết nối API: ' + err.message);
    } finally {
      setSavingValue(false);
    }
  };

  // MỞ POPUP THIẾT LẬP ID B1 / B2
  const openSectionIdModal = (section: 'B1' | 'B2') => {
    setSettingSection(section);
    setCustomIdInput(section === 'B1' ? dashboard?.b1_custom_id || '' : dashboard?.b2_custom_id || '');
  };

  // LƯU ID B1 / B2
  const handleSaveSectionId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingSection) return;

    setSavingSectionId(true);
    try {
      const payload: any = { title: dashboard.title };
      if (settingSection === 'B1') payload.b1CustomId = customIdInput;
      if (settingSection === 'B2') payload.b2CustomId = customIdInput;

      const res = await fetch(`/api/v1/dashboards/${dashboardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setDashboard((prev: any) => ({
          ...prev,
          ...(settingSection === 'B1' ? { b1_custom_id: customIdInput } : { b2_custom_id: customIdInput }),
        }));
        setSettingSection(null);
      }
    } catch (err: any) {
      alert('Lỗi kết nối API: ' + err.message);
    } finally {
      setSavingSectionId(false);
    }
  };

  // XÓA DASHBOARD
  const handleDeleteDashboard = async () => {
    if (!confirm(`Bạn có chắc chắn muốn xóa "${dashboard.title}" không?`)) return;

    try {
      const res = await fetch(`/api/v1/dashboards/${dashboardId}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Đã xóa Dashboard!');
        router.push('/');
      }
    } catch (err: any) {
      alert('Lỗi xóa: ' + err.message);
    }
  };

  // TÍNH TOÁN B1
  const smeTotal = kpiBusiness?.sme_total || 0;
  const hkdTotal = kpiBusiness?.hkd_total || 0;
  const htxTotal = kpiBusiness?.htx_total || 0;
  const sumB1Total = smeTotal + hkdTotal + htxTotal;

  const smeCds = kpiBusiness?.sme_cds || 0;
  const hkdCds = kpiBusiness?.hkd_cds || 0;
  const htxCds = kpiBusiness?.htx_cds || kpiBusiness?.htxCds || 0;
  const sumB1Cds = smeCds + hkdCds + htxCds;

  const cdsRate = sumB1Total > 0 ? ((sumB1Cds / sumB1Total) * 100).toFixed(1) : '0';

  // TÍNH TOÁN B2
  const ocop3 = kpiProducts?.ocop_3star || 0;
  const ocop4 = kpiProducts?.ocop_4star || 0;
  const ocop5 = kpiProducts?.ocop_5star || 0;
  const ocopTotal = ocop3 + ocop4 + ocop5;
  const spThuongTotal = kpiProducts?.sp_thuong || 0;
  const dichVuTotal = kpiProducts?.dich_vu || 0;
  const sumB2Total = ocopTotal + spThuongTotal + dichVuTotal;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-white flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
        <span>Đang nạp dữ liệu Dashboard...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 pb-20">
      {/* HEADER CHI TIẾT */}
      <header className="border-b border-slate-800 bg-[#111827] sticky top-0 z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-slate-300" />
            </button>
            <div>
              <h1 className="font-bold text-lg text-cyan-400">{dashboard?.title}</h1>
              <p className="text-xs text-slate-400">
                Đơn vị hành chính: {dashboard?.unit?.name || 'Tỉnh / Xã'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs px-3 py-2 rounded-lg"
            >
              <Edit3 className="w-3.5 h-3.5" /> Sửa
            </button>
            <button
              onClick={handleDeleteDashboard}
              className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs px-3 py-2 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        
        {/* ==================== TẦNG 1 ==================== */}
        <section className="space-y-6">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-cyan-400 flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              TẦNG 1: BỘ TIÊU CHÍ KINH TẾ SỐ CỦA {dashboard?.unit?.name?.toUpperCase()}
            </h2>
          </div>

          {/* ------------ MỤC B1 ------------ */}
          <div className="p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-lg text-white">
                  B1: THÔNG TIN ĐƠN VỊ KINH DOANH - {dashboard?.unit?.name?.toUpperCase()}
                </h3>
                {dashboard?.b1_custom_id && (
                  <p className="text-xs text-cyan-400">ID Cấu hình: {dashboard.b1_custom_id}</p>
                )}
              </div>
              
              <button
                onClick={() => openSectionIdModal('B1')}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-600/30"
              >
                <Settings className="w-3.5 h-3.5" />
                Thiết lập B1
              </button>
            </div>

            {/* Cụm 1: TỔNG SỐ DOANH NGHIỆP / HKD / HTX */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                TỔNG SỐ DOANH NGHIỆP / HKD / HTX
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                  label="Tổng Số Doanh Nghiệp Vừa Và Nhỏ"
                  value={smeTotal}
                  metricKey="SME_TOTAL"
                  hasLink={!!metricLinks['SME_TOTAL']}
                  onClick={() => handleMetricClick('SME_TOTAL', 'Tổng Số Doanh Nghiệp Vừa Và Nhỏ')}
                  onSetting={(e) => openSetLinkModal('SME_TOTAL', 'Tổng Số Doanh Nghiệp Vừa Và Nhỏ', e)}
                  onInput={(e) => openInputValueModal('SME_TOTAL', 'Tổng Số Doanh Nghiệp Vừa Và Nhỏ', 'B1', 'sme_total', smeTotal, e)}
                />
                <MetricCard
                  label="Tổng Số Hộ Kinh Doanh"
                  value={hkdTotal}
                  metricKey="HKD_TOTAL"
                  hasLink={!!metricLinks['HKD_TOTAL']}
                  onClick={() => handleMetricClick('HKD_TOTAL', 'Tổng Số Hộ Kinh Doanh')}
                  onSetting={(e) => openSetLinkModal('HKD_TOTAL', 'Tổng Số Hộ Kinh Doanh', e)}
                  onInput={(e) => openInputValueModal('HKD_TOTAL', 'Tổng Số Hộ Kinh Doanh', 'B1', 'hkd_total', hkdTotal, e)}
                />
                <MetricCard
                  label="Tổng Số Hợp Tác Xã"
                  value={htxTotal}
                  metricKey="HTX_TOTAL"
                  hasLink={!!metricLinks['HTX_TOTAL']}
                  onClick={() => handleMetricClick('HTX_TOTAL', 'Tổng Số Hợp Tác Xã')}
                  onSetting={(e) => openSetLinkModal('HTX_TOTAL', 'Tổng Số Hợp Tác Xã', e)}
                  onInput={(e) => openInputValueModal('HTX_TOTAL', 'Tổng Số Hợp Tác Xã', 'B1', 'htx_total', htxTotal, e)}
                />
              </div>
            </div>

            {/* Cụm 2: TỔNG SỐ CHUYỂN ĐỔI SỐ */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                TỔNG SỐ DOANH NGHIỆP / HKD / HTX CHUYỂN ĐỔI SỐ
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                  label="DN Vừa Và Nhỏ Chuyển Đổi Số"
                  value={smeCds}
                  metricKey="SME_CDS"
                  accentColor="emerald"
                  hasLink={!!metricLinks['SME_CDS']}
                  onClick={() => handleMetricClick('SME_CDS', 'DN Vừa Và Nhỏ Chuyển Đổi Số')}
                  onSetting={(e) => openSetLinkModal('SME_CDS', 'DN Vừa Và Nhỏ Chuyển Đổi Số', e)}
                  onInput={(e) => openInputValueModal('SME_CDS', 'DN Vừa Và Nhỏ Chuyển Đổi Số', 'B1', 'sme_cds', smeCds, e)}
                />
                <MetricCard
                  label="Hộ Kinh Doanh Chuyển Đổi Số"
                  value={hkdCds}
                  metricKey="HKD_CDS"
                  accentColor="emerald"
                  hasLink={!!metricLinks['HKD_CDS']}
                  onClick={() => handleMetricClick('HKD_CDS', 'Hộ Kinh Doanh Chuyển Đổi Số')}
                  onSetting={(e) => openSetLinkModal('HKD_CDS', 'Hộ Kinh Doanh Chuyển Đổi Số', e)}
                  onInput={(e) => openInputValueModal('HKD_CDS', 'Hộ Kinh Doanh Chuyển Đổi Số', 'B1', 'hkd_cds', hkdCds, e)}
                />
                <MetricCard
                  label="Hợp Tác Xã Chuyển Đổi Số"
                  value={htxCds}
                  metricKey="HTX_CDS"
                  accentColor="emerald"
                  hasLink={!!metricLinks['HTX_CDS']}
                  onClick={() => handleMetricClick('HTX_CDS', 'Hợp Tác Xã Chuyển Đổi Số')}
                  onSetting={(e) => openSetLinkModal('HTX_CDS', 'Hợp Tác Xã Chuyển Đổi Số', e)}
                  onInput={(e) => openInputValueModal('HTX_CDS', 'Hợp Tác Xã Chuyển Đổi Số', 'B1', 'htx_cds', htxCds, e)}
                />
              </div>
            </div>

            {/* TỈ LỆ CĐS VÀ BIỂU ĐỒ CƠ CẤU */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
              <div className="p-4 rounded-xl bg-[#1E293B]/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-semibold block mb-1">
                    TỈ LỆ DOANH NGHIỆP/ HKD/ HTX CHUYỂN ĐỔI SỐ
                  </span>
                  <div className="text-3xl font-extrabold text-emerald-400 flex items-center gap-2">
                    {cdsRate}%
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500/30 border-t-emerald-400 flex items-center justify-center font-bold text-xs text-emerald-400">
                  {cdsRate}%
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#1E293B]/60 border border-slate-800">
                <span className="text-xs text-slate-400 font-semibold block mb-3 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-cyan-400" />
                  BIỂU ĐỒ TỈ LỆ CƠ CẤU ĐƠN VỊ KINH DOANH
                </span>
                
                <div className="w-full h-4 rounded-full bg-slate-800 overflow-hidden flex mb-3">
                  <div style={{ width: `${sumB1Total > 0 ? (smeTotal / sumB1Total) * 100 : 33}%` }} className="bg-cyan-500 h-full" />
                  <div style={{ width: `${sumB1Total > 0 ? (hkdTotal / sumB1Total) * 100 : 33}%` }} className="bg-amber-500 h-full" />
                  <div style={{ width: `${sumB1Total > 0 ? (htxTotal / sumB1Total) * 100 : 34}%` }} className="bg-purple-500 h-full" />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> DN ({smeTotal})</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> HKD ({hkdTotal})</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> HTX ({htxTotal})</span>
                </div>
              </div>
            </div>
          </div>

          {/* ------------ MỤC B2 ------------ */}
          <div className="p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-lg text-white">
                  B2: THÔNG TIN SẢN PHẨM TRÊN ĐỊA BÀN
                </h3>
                {dashboard?.b2_custom_id && (
                  <p className="text-xs text-amber-400">ID Cấu hình: {dashboard.b2_custom_id}</p>
                )}
              </div>

              <button
                onClick={() => openSectionIdModal('B2')}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30"
              >
                <Settings className="w-3.5 h-3.5" />
                Thiết lập B2
              </button>
            </div>

            {/* Thẻ Sản phẩm OCOP & Thường */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                TỔNG SỐ SẢN PHẨM / DỊCH VỤ
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard
                  label="Tổng Sản Phẩm OCOP"
                  value={ocopTotal}
                  metricKey="OCOP_TOTAL"
                  accentColor="amber"
                  hasLink={!!metricLinks['OCOP_TOTAL']}
                  onClick={() => handleMetricClick('OCOP_TOTAL', 'Tổng Sản Phẩm OCOP')}
                  onSetting={(e) => openSetLinkModal('OCOP_TOTAL', 'Tổng Sản Phẩm OCOP', e)}
                />
                <MetricCard
                  label="OCOP 3 Sao"
                  value={ocop3}
                  metricKey="OCOP_3STAR"
                  accentColor="amber"
                  hasLink={!!metricLinks['OCOP_3STAR']}
                  onClick={() => handleMetricClick('OCOP_3STAR', 'OCOP 3 Sao')}
                  onSetting={(e) => openSetLinkModal('OCOP_3STAR', 'OCOP 3 Sao', e)}
                  onInput={(e) => openInputValueModal('OCOP_3STAR', 'OCOP 3 Sao', 'B2', 'ocop_3star', ocop3, e)}
                />
                <MetricCard
                  label="OCOP 4 Sao"
                  value={ocop4}
                  metricKey="OCOP_4STAR"
                  accentColor="amber"
                  hasLink={!!metricLinks['OCOP_4STAR']}
                  onClick={() => handleMetricClick('OCOP_4STAR', 'OCOP 4 Sao')}
                  onSetting={(e) => openSetLinkModal('OCOP_4STAR', 'OCOP 4 Sao', e)}
                  onInput={(e) => openInputValueModal('OCOP_4STAR', 'OCOP 4 Sao', 'B2', 'ocop_4star', ocop4, e)}
                />
                <MetricCard
                  label="OCOP 5 Sao"
                  value={ocop5}
                  metricKey="OCOP_5STAR"
                  accentColor="amber"
                  hasLink={!!metricLinks['OCOP_5STAR']}
                  onClick={() => handleMetricClick('OCOP_5STAR', 'OCOP 5 Sao')}
                  onSetting={(e) => openSetLinkModal('OCOP_5STAR', 'OCOP 5 Sao', e)}
                  onInput={(e) => openInputValueModal('OCOP_5STAR', 'OCOP 5 Sao', 'B2', 'ocop_5star', ocop5, e)}
                />
                <MetricCard
                  label="Tổng Sản Phẩm Thường"
                  value={spThuongTotal}
                  metricKey="SP_THUONG"
                  accentColor="cyan"
                  hasLink={!!metricLinks['SP_THUONG']}
                  onClick={() => handleMetricClick('SP_THUONG', 'Tổng Sản Phẩm Thường')}
                  onSetting={(e) => openSetLinkModal('SP_THUONG', 'Tổng Sản Phẩm Thường', e)}
                  onInput={(e) => openInputValueModal('SP_THUONG', 'Tổng Sản Phẩm Thường', 'B2', 'sp_thuong', spThuongTotal, e)}
                />
                <MetricCard
                  label="Tổng Số Dịch Vụ"
                  value={dichVuTotal}
                  metricKey="DICH_VU"
                  accentColor="cyan"
                  hasLink={!!metricLinks['DICH_VU']}
                  onClick={() => handleMetricClick('DICH_VU', 'Tổng Số Dịch Vụ')}
                  onSetting={(e) => openSetLinkModal('DICH_VU', 'Tổng Số Dịch Vụ', e)}
                  onInput={(e) => openInputValueModal('DICH_VU', 'Tổng Số Dịch Vụ', 'B2', 'dich_vu', dichVuTotal, e)}
                />
              </div>
            </div>

            {/* TỈ LỆ CÁC LOẠI SẢN PHẨM */}
            <div className="pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-400 font-semibold block mb-3 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-amber-400" />
                TỈ LỆ CÁC LOẠI SẢN PHẨM & DỊCH VỤ
              </span>
              
              <div className="w-full h-4 rounded-full bg-slate-800 overflow-hidden flex mb-3">
                <div style={{ width: `${sumB2Total > 0 ? (ocopTotal / sumB2Total) * 100 : 33}%` }} className="bg-amber-500 h-full" />
                <div style={{ width: `${sumB2Total > 0 ? (spThuongTotal / sumB2Total) * 100 : 33}%` }} className="bg-cyan-500 h-full" />
                <div style={{ width: `${sumB2Total > 0 ? (dichVuTotal / sumB2Total) * 100 : 34}%` }} className="bg-emerald-500 h-full" />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> OCOP ({ocopTotal})</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Thường ({spThuongTotal})</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Dịch vụ ({dichVuTotal})</span>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== TẦNG 2 ==================== */}
        <section className="p-6 rounded-2xl bg-[#111827] border border-slate-800 space-y-4">
          <div className="flex items-center gap-3 text-cyan-400 border-b border-slate-800 pb-3">
            <Landmark className="w-5 h-5" />
            <h3 className="font-bold text-base">TẦNG 2: TIÊU CHÍ NỀN TẢNG KINH TẾ SỐ</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
            <div className="p-4 rounded-xl bg-[#1E293B]/40 border border-slate-800">
              <span className="font-semibold text-white block mb-1">Hạ Tầng Viễn Thông & Internet</span>
              <p>Đồng bộ tỷ lệ phủ sóng 4G/5G, cáp quang hộ gia đình trên địa bàn.</p>
            </div>
            <div className="p-4 rounded-xl bg-[#1E293B]/40 border border-slate-800">
              <span className="font-semibold text-white block mb-1">Thanh Toán Không Tiền Mặt</span>
              <p>Tỷ lệ tài khoản ngân hàng / ví điện tử áp dụng tại cửa hàng, hộ kinh doanh.</p>
            </div>
            <div className="p-4 rounded-xl bg-[#1E293B]/40 border border-slate-800">
              <span className="font-semibold text-white block mb-1">An Toàn Thông Tin Số</span>
              <p>Tiêu chuẩn bảo mật dữ liệu và dịch vụ công trực tuyến cấp chính quyền.</p>
            </div>
          </div>
        </section>

        {/* ==================== TẦNG 3 ==================== */}
        <section className="p-6 rounded-2xl bg-[#111827] border border-slate-800 space-y-4">
          <div className="flex items-center gap-3 text-amber-400 border-b border-slate-800 pb-3">
            <Briefcase className="w-5 h-5" />
            <h3 className="font-bold text-base">TẦNG 3: DỰ ÁN KÊU GỌI ĐẦU TƯ – QUY HOẠCH</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
            <div className="p-4 rounded-xl bg-[#1E293B]/40 border border-slate-800 flex items-start justify-between">
              <div>
                <span className="font-semibold text-white block mb-1">Danh Mục Dự Án Kêu Gọi Đầu Tư</span>
                <p>Các cụm công nghiệp, vùng nông nghiệp công nghệ cao của địa phương.</p>
              </div>
              <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold">Đang cập nhật</span>
            </div>
            <div className="p-4 rounded-xl bg-[#1E293B]/40 border border-slate-800 flex items-start justify-between">
              <div>
                <span className="font-semibold text-white block mb-1">Bản Đồ Quy Hoạch Sử Dụng Đất</span>
                <p>Tra cứu bản đồ quy hoạch phân khu và mục đích sử dụng đất kinh tế.</p>
              </div>
              <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold">Xem bản đồ</span>
            </div>
          </div>
        </section>

        {/* ==================== TẦNG 4 ==================== */}
        <section className="p-6 rounded-2xl bg-[#111827] border border-slate-800 space-y-4">
          <div className="flex items-center gap-3 text-emerald-400 border-b border-slate-800 pb-3">
            <HelpCircle className="w-5 h-5" />
            <h3 className="font-bold text-base">TẦNG 4: CHÍNH SÁCH & GIẢI ĐÁP KIẾN NGHỊ</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
            <div className="p-4 rounded-xl bg-[#1E293B]/40 border border-slate-800">
              <span className="font-semibold text-white block mb-1">Chính Sách Ưu Đãi Đầu Tư</span>
              <p>Tổng hợp các nghị quyết, chính sách hỗ trợ thuế và mặt bằng của tỉnh.</p>
            </div>
            <div className="p-4 rounded-xl bg-[#1E293B]/40 border border-slate-800">
              <span className="font-semibold text-white block mb-1">Hệ Thống Tiếp Nhận & Giải Đáp Kiến Nghị</span>
              <p>Cổng gửi phản ánh dành cho doanh nghiệp và hộ kinh doanh trực tuyến.</p>
            </div>
          </div>
        </section>

        {/* ==================== TẦNG 5 ==================== */}
        <section className="p-6 rounded-2xl bg-[#111827] border border-slate-800 space-y-4">
          <div className="flex items-center gap-3 text-purple-400 border-b border-slate-800 pb-3">
            <Store className="w-5 h-5" />
            <h3 className="font-bold text-base">TẦNG 5: ĐIỂM TRƯNG BÀY & HỘI QUÁN</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
            <div className="p-4 rounded-xl bg-[#1E293B]/40 border border-slate-800">
              <span className="font-semibold text-white block mb-1">Điểm Trưng Bày Sản Phẩm Số</span>
              <p>Không gian triển lãm thực tế ảo VR các sản phẩm OCOP đặc trưng địa phương.</p>
            </div>
            <div className="p-4 rounded-xl bg-[#1E293B]/40 border border-slate-800">
              <span className="font-semibold text-white block mb-1">Mô Hình Hội Quán Kinh Tế Số</span>
              <p>Nơi giao lưu, trao đổi kinh nghiệm chuyển đổi số giữa các doanh nghiệp/HTX.</p>
            </div>
          </div>
        </section>

        {/* ==================== TÀI LIỆU CĐS ==================== */}
        <section className="p-6 rounded-2xl bg-[#111827] border border-slate-800 space-y-4">
          <div className="flex items-center gap-3 text-blue-400 border-b border-slate-800 pb-3">
            <BookOpen className="w-5 h-5" />
            <h3 className="font-bold text-base">TÀI LIỆU CHUYỂN ĐỔI SỐ CHO DOANH NGHIỆP</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
            <a href="#" className="p-4 rounded-xl bg-[#1E293B]/40 border border-slate-800 hover:border-blue-500/50 transition-all flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block mb-1">Cẩm Nang CĐS Cho SME</span>
                <p>Hướng dẫn từng bước triển khai phần mềm quản lý & kế toán số.</p>
              </div>
              <FileText className="w-5 h-5 text-blue-400 shrink-0 ml-2" />
            </a>
            <a href="#" className="p-4 rounded-xl bg-[#1E293B]/40 border border-slate-800 hover:border-blue-500/50 transition-all flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block mb-1">Bộ Tiêu Chí Đánh Giá Mức Độ CĐS</span>
                <p>Khung đánh giá readiness level của Bộ Thông tin & Truyền thông.</p>
              </div>
              <FileText className="w-5 h-5 text-blue-400 shrink-0 ml-2" />
            </a>
            <a href="#" className="p-4 rounded-xl bg-[#1E293B]/40 border border-slate-800 hover:border-blue-500/50 transition-all flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block mb-1">Hướng Dẫn Đưa Nông Sản Lên Sàn TMĐT</span>
                <p>Quy trình đóng gói, chụp ảnh và vận hành gian hàng trực tuyến.</p>
              </div>
              <FileText className="w-5 h-5 text-blue-400 shrink-0 ml-2" />
            </a>
          </div>
        </section>

      </main>

      {/* POPUP 1: CÀI LINK ⚙️ */}
      {settingMetric && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold mb-1 text-white">THIẾT LẬP LINK LIÊN KẾT TARGET URL</h3>
            <p className="text-xs text-slate-400 mb-4">{settingMetric.label}</p>

            <form onSubmit={handleSaveMetricLink} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Đường dẫn Link chuyển hướng (URL)</label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/chitiet"
                  value={targetUrlInput}
                  onChange={(e) => setTargetUrlInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-[#1E293B] border-slate-700 text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSettingMetric(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingLink}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  {savingLink ? 'Đang lưu...' : 'Lưu Liên Kết'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP 2: NHẬP SỐ LIỆU TRỰC TIẾP ✏️ */}
      {inputtingMetric && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <Pencil className="w-4 h-4 text-cyan-400" />
              <h3 className="text-base font-bold text-white">NHẬP SỐ LIỆU CHO THÔNG SỐ</h3>
            </div>
            <p className="text-xs text-cyan-400 font-semibold mb-4">{inputtingMetric.label}</p>

            <form onSubmit={handleSaveMetricValue} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Số liệu mới</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newValueInput}
                  onChange={(e) => setNewValueInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-[#1E293B] border-slate-700 text-white font-bold text-lg outline-none focus:border-cyan-500"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setInputtingMetric(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingValue}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20"
                >
                  {savingValue ? 'Đang lưu...' : 'Cập Nhật Số Liệu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP 3: THIẾT LẬP ID B1 / B2 */}
      {settingSection && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold mb-1 text-white">
              THIẾT LẬP ID CHO MỤC {settingSection}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Nhập ID cấu hình / API Key tùy chỉnh dành riêng cho Mục {settingSection}
            </p>

            <form onSubmit={handleSaveSectionId} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">ID Cấu hình / Mã định danh</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: B1_KIEN_GIANG_2026"
                  value={customIdInput}
                  onChange={(e) => setCustomIdInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-[#1E293B] border-slate-700 text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSettingSection(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingSectionId}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  {savingSectionId ? 'Đang lưu...' : 'Lưu ID'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// COMPONENT MẪU THẺ CHỈ SỐ NHỎ CÓ ICON ⚙️ TRÊN BÊN TRÁI VÀ ✏️ TRÊN BÊN PHẢI
function MetricCard({
  label,
  value,
  metricKey,
  accentColor = 'cyan',
  hasLink = false,
  onClick,
  onSetting,
  onInput,
}: {
  label: string;
  value: number | string;
  metricKey: string;
  accentColor?: 'cyan' | 'emerald' | 'amber';
  hasLink?: boolean;
  onClick: () => void;
  onSetting: (e: React.MouseEvent) => void;
  onInput?: (e: React.MouseEvent) => void;
}) {
  const colorMap = {
    cyan: { text: 'text-cyan-400', border: 'hover:border-cyan-500/50', badge: 'text-cyan-500' },
    emerald: { text: 'text-emerald-400', border: 'hover:border-emerald-500/50', badge: 'text-emerald-500' },
    amber: { text: 'text-amber-400', border: 'hover:border-amber-500/50', badge: 'text-amber-500' },
  };

  const style = colorMap[accentColor];

  return (
    <div
      onClick={onClick}
      className={`group relative p-4 rounded-xl bg-[#1E293B]/60 border border-slate-800 ${style.border} cursor-pointer transition-all shadow-md`}
    >
      <div className="flex justify-between items-start mb-2 gap-1">
        <span className="text-xs text-slate-400 font-medium leading-tight">{label}</span>
        
        {/* CỤM ICON BÊN TRÊN GÓC PHẢI THẺ: ⚙️ (TRÁI) VÀ ✏️ (PHẢI) */}
        <div className="flex items-center gap-1 z-10 shrink-0">
          {/* Icon Thiết lập Link ⚙️ */}
          <button
            onClick={onSetting}
            className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
            title="Thiết lập link chuyển hướng"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Icon Nhập Số Liệu ✏️ (Đặt bên phải icon thiết lập) */}
          {onInput && (
            <button
              onClick={onInput}
              className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
              title="Nhập / Sửa số liệu"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className={`text-2xl font-extrabold mb-1 ${style.text}`}>{value}</div>

      {hasLink ? (
        <div className={`text-[10px] ${style.badge} flex items-center gap-1 font-semibold`}>
          <ExternalLink className="w-3 h-3" /> Đã cài link (Click mở)
        </div>
      ) : (
        <div className="text-[10px] text-slate-600">Bấm ⚙️ cài link, ✏️ nhập số</div>
      )}
    </div>
  );
}