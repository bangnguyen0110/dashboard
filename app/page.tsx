'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Building2, Plus, Search, Moon, Sun, 
  RefreshCw, BarChart3, Edit3, Trash2, Check, ChevronDown,
  Layers, ArrowRight, TrendingUp, Building, Users,
  ShoppingBag, ArrowLeft, PieChart
} from 'lucide-react';

export default function HomePage() {
  const [provinceDashboards, setProvinceDashboards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchProvince, setSearchProvince] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // State Quản lý Tỉnh đang chọn
  const [selectedProvinceDash, setSelectedProvinceDash] = useState<any>(null);
  const [communeDashboards, setCommuneDashboards] = useState<any[]>([]);
  const [searchCommune, setSearchCommune] = useState('');
  const [loadingCommunes, setLoadingCommunes] = useState(false);
  const [provinceAggregatedStats, setProvinceAggregatedStats] = useState<any>({
    sme_total: 0, hkd_total: 0, htx_total: 0,
    sme_cds: 0, hkd_cds: 0, htx_cds: 0,
    ocop_3star: 0, ocop_4star: 0, ocop_5star: 0,
    sp_thuong: 0, dich_vu: 0
  });

  // State Modal Tạo Dashboard Tỉnh
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availableProvinces, setAvailableProvinces] = useState<any[]>([]);
  const [selectedProvinceUnit, setSelectedProvinceUnit] = useState<any>(null);
  const [provinceSearchQuery, setProvinceSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [domainLink, setDomainLink] = useState('');
  const [syncSchedule, setSyncSchedule] = useState('0 0 * * *');
  const [submitting, setSubmitting] = useState(false);

  // State Modal Sửa Dashboard
  const [editingDash, setEditingDash] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDomain, setEditDomain] = useState('');

  // 1. Tải danh sách Dashboard Cấp Tỉnh
  const fetchProvinceDashboards = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('dashboards')
      .select('*, unit:administrative_units(*)')
      .order('created_at', { ascending: false });

    if (data) {
      const provincesOnly = data.filter((item) => item.unit?.type === 'PROVINCE');
      setProvinceDashboards(provincesOnly);
    }
    setLoading(false);
  };

  // 2. Tải danh sách Tỉnh từ DB
  const fetchAvailableProvinces = async () => {
    const { data } = await supabase
      .from('administrative_units')
      .select('*')
      .eq('type', 'PROVINCE')
      .order('name', { ascending: true });

    if (data) setAvailableProvinces(data);
  };

  useEffect(() => {
    fetchProvinceDashboards();
    fetchAvailableProvinces();
  }, []);

  // 3. Chọn Tỉnh -> Tính TỔNG CỘNG THỐNG KÊ từ tất cả Xã/Phường
  const handleSelectProvince = async (provDash: any) => {
    setSelectedProvinceDash(provDash);
    setLoadingCommunes(true);

    try {
      const provinceUnitId = provDash.unit_id;

      const { data: childUnits } = await supabase
        .from('administrative_units')
        .select('id')
        .eq('parent_id', provinceUnitId);

      const childUnitIds = childUnits?.map((u) => u.id) || [];

      if (childUnitIds.length > 0) {
        const { data: communes } = await supabase
          .from('dashboards')
          .select('*, unit:administrative_units(*)')
          .in('unit_id', childUnitIds)
          .order('title', { ascending: true });

        setCommuneDashboards(communes || []);

        const communeDashIds = communes?.map((c) => c.id) || [];

        if (communeDashIds.length > 0) {
          const { data: b1List } = await supabase
            .from('kpi_business_units')
            .select('*')
            .in('dashboard_id', communeDashIds);

          const { data: b2List } = await supabase
            .from('kpi_products')
            .select('*')
            .in('dashboard_id', communeDashIds);

          const agg = {
            sme_total: 0, hkd_total: 0, htx_total: 0,
            sme_cds: 0, hkd_cds: 0, htx_cds: 0,
            ocop_3star: 0, ocop_4star: 0, ocop_5star: 0,
            sp_thuong: 0, dich_vu: 0
          };

          b1List?.forEach((b1) => {
            agg.sme_total += b1.sme_total || 0;
            agg.hkd_total += b1.hkd_total || 0;
            agg.htx_total += b1.htx_total || 0;
            agg.sme_cds += b1.sme_cds || 0;
            agg.hkd_cds += b1.hkd_cds || 0;
            agg.htx_cds += b1.htx_cds || b1.htxCds || 0;
          });

          b2List?.forEach((b2) => {
            agg.ocop_3star += b2.ocop_3star || 0;
            agg.ocop_4star += b2.ocop_4star || 0;
            agg.ocop_5star += b2.ocop_5star || 0;
            agg.sp_thuong += b2.sp_thuong || 0;
            agg.dich_vu += b2.dich_vu || 0;
          });

          setProvinceAggregatedStats(agg);
        } else {
          resetAggregatedStats();
        }
      } else {
        setCommuneDashboards([]);
        resetAggregatedStats();
      }
    } catch (err) {
      console.error('Lỗi nạp dữ liệu xã phường:', err);
    } finally {
      setLoadingCommunes(false);
    }
  };

  const resetAggregatedStats = () => {
    setProvinceAggregatedStats({
      sme_total: 0, hkd_total: 0, htx_total: 0,
      sme_cds: 0, hkd_cds: 0, htx_cds: 0,
      ocop_3star: 0, ocop_4star: 0, ocop_5star: 0,
      sp_thuong: 0, dich_vu: 0
    });
  };

  // Xóa Dashboard
  const handleDeleteDashboard = async (e: React.MouseEvent, dash: any) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Bạn có chắc chắn muốn xóa "${dash.title}" không?`)) return;

    try {
      const res = await fetch(`/api/v1/dashboards/${dash.id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Đã xóa Dashboard thành công!');
        if (selectedProvinceDash?.id === dash.id) setSelectedProvinceDash(null);
        fetchProvinceDashboards();
      }
    } catch (err: any) {
      alert('Lỗi xóa: ' + err.message);
    }
  };

  // Sửa Dashboard
  const handleUpdateDashboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/dashboards/${editingDash.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, domainLink: editDomain }),
      });

      if (res.ok) {
        alert('Cập nhật thành công!');
        setEditingDash(null);
        fetchProvinceDashboards();
      }
    } catch (err: any) {
      alert('Lỗi cập nhật: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Tạo Dashboard Tỉnh mới
  const handleCreateProvince = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvinceUnit) return alert('Vui lòng chọn Tỉnh / Thành phố!');

    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/dashboards/create-province', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provinceId: selectedProvinceUnit.id,
          domainLink,
          syncSchedule,
        }),
      });

      const resData = await response.json();
      if (response.ok) {
        alert(resData.message || 'Tạo Dashboard Tỉnh & Xã trực thuộc thành công!');
        setShowCreateModal(false);
        setSelectedProvinceUnit(null);
        setDomainLink('');
        fetchProvinceDashboards();
      } else {
        alert('Lỗi: ' + resData.error);
      }
    } catch (err: any) {
      alert('Không thể kết nối API: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProvinces = provinceDashboards.filter((item) =>
    item.title?.toLowerCase().includes(searchProvince.toLowerCase()) ||
    item.unit?.name?.toLowerCase().includes(searchProvince.toLowerCase())
  );

  const filteredCommunes = communeDashboards.filter((item) =>
    item.title?.toLowerCase().includes(searchCommune.toLowerCase()) ||
    item.unit?.name?.toLowerCase().includes(searchCommune.toLowerCase())
  );

  // Tính toán tổng B1/B2
  const sumB1 = provinceAggregatedStats.sme_total + provinceAggregatedStats.hkd_total + provinceAggregatedStats.htx_total;
  const sumB1Cds = provinceAggregatedStats.sme_cds + provinceAggregatedStats.hkd_cds + provinceAggregatedStats.htx_cds;
  const cdsRate = sumB1 > 0 ? ((sumB1Cds / sumB1) * 100).toFixed(1) : '0';

  const ocopTotal = provinceAggregatedStats.ocop_3star + provinceAggregatedStats.ocop_4star + provinceAggregatedStats.ocop_5star;
  const sumB2Total = ocopTotal + provinceAggregatedStats.sp_thuong + provinceAggregatedStats.dich_vu;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[#0B0F19] text-slate-100' : 'bg-slate-50 text-slate-900'} pb-16`}>
      {/* HEADER TỔNG */}
      <header className={`border-b ${isDarkMode ? 'border-slate-800 bg-[#111827]' : 'border-slate-200 bg-white'} sticky top-0 z-20 px-6 py-4`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">BẢNG ĐIỀU KHIỂN KINH TẾ SỐ</h1>
              <p className="text-xs text-slate-400">Hệ thống đồng bộ thông số dữ liệu Việt Nam</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-cyan-600/20"
            >
              <Plus className="w-4 h-4" />
              Tạo dashboard tỉnh
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-lg border ${isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* ================= PHẦN 1: DRILL-DOWN CỦA 1 TỈNH ================= */}
        {selectedProvinceDash ? (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Thanh quay lại */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedProvinceDash(null)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-[#111827] text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-400" /> Quay lại danh sách Tỉnh
              </button>

              <Link
                href={`/dashboard/${selectedProvinceDash.id}`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20"
              >
                Mở Trang Chi Tiết Dashboard {selectedProvinceDash.unit?.name} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* BẢNG THÔNG TIN TỔNG QUÁT TẤT CẢ XÃ/PHƯỜNG CỦA TỈNH */}
            <section className="p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider block mb-1">
                    THÔNG TIN TỔNG QUÁT TỔNG HỢP CẤP TỈNH
                  </span>
                  <h2 className="text-xl font-extrabold text-white">
                    {selectedProvinceDash.title}
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Tổng số đơn vị trực thuộc</span>
                  <div className="text-lg font-bold text-cyan-400">{communeDashboards.length} Xã / Phường / Đặc khu</div>
                </div>
              </div>

              {/* KHỐI CHỈ SỐ B1 TỔNG HỢP - GOM THÀNH 3 CỤM TRÊN 1 HÀNG */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Building className="w-4 h-4 text-cyan-400" /> B1: THÔNG TIN TỔNG CỘNG ĐƠN VỊ KINH DOANH
                </h3>

                {/* 1 HÀNG CÓ 3 CỤM THỐNG KÊ */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* CỤM 1: DOANH NGHIỆP (SME) */}
                  <div className="p-5 rounded-xl bg-[#1E293B]/60 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex justify-between items-center">
                      <span>Doanh Nghiệp Vừa & Nhỏ (SME)</span>
                      <Building className="w-4 h-4 text-cyan-400" />
                    </h4>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-1">Tổng Số</span>
                        <div className="text-2xl font-extrabold text-cyan-400">
                          {provinceAggregatedStats.sme_total}
                        </div>
                      </div>
                      <div className="border-l border-slate-800 pl-3">
                        <span className="text-[11px] text-slate-400 block mb-1">Chuyển Đổi Số</span>
                        <div className="text-2xl font-extrabold text-emerald-400">
                          {provinceAggregatedStats.sme_cds}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CỤM 2: HỘ KINH DOANH (HKD) */}
                  <div className="p-5 rounded-xl bg-[#1E293B]/60 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex justify-between items-center">
                      <span>Hộ Kinh Doanh (HKD)</span>
                      <Users className="w-4 h-4 text-cyan-400" />
                    </h4>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-1">Tổng Số</span>
                        <div className="text-2xl font-extrabold text-cyan-400">
                          {provinceAggregatedStats.hkd_total}
                        </div>
                      </div>
                      <div className="border-l border-slate-800 pl-3">
                        <span className="text-[11px] text-slate-400 block mb-1">Chuyển Đổi Số</span>
                        <div className="text-2xl font-extrabold text-emerald-400">
                          {provinceAggregatedStats.hkd_cds}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CỤM 3: HỢP TÁC XÃ (HTX) */}
                  <div className="p-5 rounded-xl bg-[#1E293B]/60 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex justify-between items-center">
                      <span>Hợp Tác Xã (HTX)</span>
                      <Building2 className="w-4 h-4 text-cyan-400" />
                    </h4>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-1">Tổng Số</span>
                        <div className="text-2xl font-extrabold text-cyan-400">
                          {provinceAggregatedStats.htx_total}
                        </div>
                      </div>
                      <div className="border-l border-slate-800 pl-3">
                        <span className="text-[11px] text-slate-400 block mb-1">Chuyển Đổi Số</span>
                        <div className="text-2xl font-extrabold text-emerald-400">
                          {provinceAggregatedStats.htx_cds}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* THẺ TỈ LỆ CĐS TỔNG CỘNG KHÈM BIỂU ĐỒ */}
                <div className="p-5 rounded-xl bg-[#1E293B]/60 border border-slate-800 space-y-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs text-slate-400 font-semibold block mb-1">
                        TỈ LỆ CĐS TỔNG TẤT CẢ ĐƠN VỊ KINH DOANH
                      </span>
                      <div className="text-3xl font-extrabold text-emerald-400 flex items-center gap-2">
                        {cdsRate}%
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right text-xs text-slate-400">
                        <div>Đã CĐS: <strong className="text-emerald-400">{sumB1Cds}</strong> / <strong className="text-cyan-400">{sumB1}</strong> ĐVKD</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">SME: {provinceAggregatedStats.sme_cds} | HKD: {provinceAggregatedStats.hkd_cds} | HTX: {provinceAggregatedStats.htx_cds}</div>
                      </div>

                      {/* BIỂU ĐỒ VÒNG TRÒN MINI GAUGE CHART */}
                      <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-slate-800"
                            strokeWidth="3.8"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="text-emerald-400 transition-all duration-500"
                            strokeDasharray={`${cdsRate}, 100`}
                            strokeWidth="3.8"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <span className="absolute text-[11px] font-bold text-emerald-400">{cdsRate}%</span>
                      </div>
                    </div>
                  </div>

                  {/* BIỂU ĐỒ THANH TIẾN ĐỘ TIẾN TRÌNH CĐS */}
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
                      <div
                        style={{ width: `${cdsRate}%` }}
                        className="bg-emerald-500 h-full transition-all duration-500"
                        title="Đã chuyển đổi số"
                      />
                      <div
                        style={{ width: `${100 - Number(cdsRate)}%` }}
                        className="bg-slate-700/60 h-full"
                        title="Chưa chuyển đổi số"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Đã CĐS ({sumB1Cds})
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-slate-700 inline-block" /> Chưa CĐS ({sumB1 - sumB1Cds > 0 ? sumB1 - sumB1Cds : 0})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* KHỐI CHỈ SỐ B2 TỔNG HỢP - GOM 2 CỤM TRÊN 1 HÀNG */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-400" /> B2: THÔNG TIN TỔNG CỘNG SẢN PHẨM & DỊCH VỤ
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CỤM 1: SẢN PHẨM OCOP */}
                  <div className="p-5 rounded-xl bg-[#1E293B]/60 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider border-b border-slate-800 pb-2 flex justify-between items-center">
                      <span>CỤM SẢN PHẨM OCOP</span>
                      <ShoppingBag className="w-4 h-4 text-amber-400" />
                    </h4>

                    {/* Hàng trên: Tổng SP OCOP (Rộng 100%) */}
                    <div className="p-3.5 rounded-lg bg-[#0B0F19]/80 border border-slate-800 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-300">TỔNG SỐ SẢN PHẨM OCOP</span>
                      <span className="text-2xl font-extrabold text-amber-400">{ocopTotal}</span>
                    </div>

                    {/* Hàng dưới: 3 Ô OCOP 3 Star, 4 Star, 5 Star */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 rounded-lg bg-[#0B0F19]/80 border border-slate-800/80 text-center">
                        <span className="text-[11px] text-slate-400 block mb-1 font-medium">OCOP 3 Star</span>
                        <div className="text-lg font-bold text-amber-400">{provinceAggregatedStats.ocop_3star}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-[#0B0F19]/80 border border-slate-800/80 text-center">
                        <span className="text-[11px] text-slate-400 block mb-1 font-medium">OCOP 4 Star</span>
                        <div className="text-lg font-bold text-amber-400">{provinceAggregatedStats.ocop_4star}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-[#0B0F19]/80 border border-slate-800/80 text-center">
                        <span className="text-[11px] text-slate-400 block mb-1 font-medium">OCOP 5 Star</span>
                        <div className="text-lg font-bold text-amber-400">{provinceAggregatedStats.ocop_5star}</div>
                      </div>
                    </div>
                  </div>

                  {/* CỤM 2: SẢN PHẨM THƯỜNG & DỊCH VỤ */}
                  <div className="p-5 rounded-xl bg-[#1E293B]/60 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider border-b border-slate-800 pb-2 flex justify-between items-center">
                      <span>CỤM SẢN PHẨM THƯỜNG & DỊCH VỤ</span>
                      <Layers className="w-4 h-4 text-cyan-400" />
                    </h4>

                    {/* Hàng trên: Tổng SP Thường & Dịch vụ */}
                    <div className="p-3.5 rounded-lg bg-[#0B0F19]/80 border border-slate-800 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-300">TỔNG SỐ SP THƯỜNG & DỊCH VỤ</span>
                      <span className="text-2xl font-extrabold text-cyan-400">
                        {provinceAggregatedStats.sp_thuong + provinceAggregatedStats.dich_vu}
                      </span>
                    </div>

                    {/* Hàng dưới: 2 ô SP Thường và Dịch vụ */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-[#0B0F19]/80 border border-slate-800/80 text-center">
                        <span className="text-[11px] text-slate-400 block mb-1 font-medium">Sản Phẩm Thường</span>
                        <div className="text-lg font-bold text-cyan-400">{provinceAggregatedStats.sp_thuong}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-[#0B0F19]/80 border border-slate-800/80 text-center">
                        <span className="text-[11px] text-slate-400 block mb-1 font-medium">Tổng Số Dịch Vụ</span>
                        <div className="text-lg font-bold text-cyan-400">{provinceAggregatedStats.dich_vu}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TỈ LỆ CÁC LOẠI SẢN PHẨM & DỊCH VỤ (THÔNG SỐ VÀ BIỂU ĐỒ) */}
                <div className="p-5 rounded-xl bg-[#1E293B]/60 border border-slate-800 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-amber-400" />
                      TỈ LỆ CÁC LOẠI SẢN PHẨM & DỊCH VỤ
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Tổng số lượng: <strong className="text-amber-400">{sumB2Total}</strong> sản phẩm/dịch vụ
                    </span>
                  </div>

                  {/* Thông số Tỉ lệ Phần Trăm */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-[#0B0F19]/80 border border-slate-800/60">
                      <span className="text-[11px] text-slate-400 block mb-0.5">Tỉ lệ OCOP</span>
                      <div className="text-lg font-extrabold text-amber-400">
                        {sumB2Total > 0 ? ((ocopTotal / sumB2Total) * 100).toFixed(1) : '0'}%
                      </div>
                      <span className="text-[10px] text-slate-500">({ocopTotal} sản phẩm)</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0B0F19]/80 border border-slate-800/60">
                      <span className="text-[11px] text-slate-400 block mb-0.5">Tỉ lệ SP Thường</span>
                      <div className="text-lg font-extrabold text-cyan-400">
                        {sumB2Total > 0 ? ((provinceAggregatedStats.sp_thuong / sumB2Total) * 100).toFixed(1) : '0'}%
                      </div>
                      <span className="text-[10px] text-slate-500">({provinceAggregatedStats.sp_thuong} sản phẩm)</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0B0F19]/80 border border-slate-800/60">
                      <span className="text-[11px] text-slate-400 block mb-0.5">Tỉ lệ Dịch Vụ</span>
                      <div className="text-lg font-extrabold text-emerald-400">
                        {sumB2Total > 0 ? ((provinceAggregatedStats.dich_vu / sumB2Total) * 100).toFixed(1) : '0'}%
                      </div>
                      <span className="text-[10px] text-slate-500">({provinceAggregatedStats.dich_vu} dịch vụ)</span>
                    </div>
                  </div>

                  {/* Biểu đồ Thanh Cơ Cấu Multi-Color Bar */}
                  <div className="space-y-2">
                    <div className="w-full h-4 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
                      <div
                        style={{ width: `${sumB2Total > 0 ? (ocopTotal / sumB2Total) * 100 : 33.3}%` }}
                        className="bg-amber-500 h-full transition-all duration-500"
                        title="Sản phẩm OCOP"
                      />
                      <div
                        style={{ width: `${sumB2Total > 0 ? (provinceAggregatedStats.sp_thuong / sumB2Total) * 100 : 33.3}%` }}
                        className="bg-cyan-500 h-full transition-all duration-500"
                        title="Sản phẩm thường"
                      />
                      <div
                        style={{ width: `${sumB2Total > 0 ? (provinceAggregatedStats.dich_vu / sumB2Total) * 100 : 33.4}%` }}
                        className="bg-emerald-500 h-full transition-all duration-500"
                        title="Dịch vụ"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> OCOP ({ocopTotal})
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" /> SP Thường ({provinceAggregatedStats.sp_thuong})
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Dịch Vụ ({provinceAggregatedStats.dich_vu})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* DANH SÁCH DASHBOARD XÃ/PHƯỜNG */}
            <section className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  DANH SÁCH DASHBOARD XÃ / PHƯỜNG / ĐẶC KHU CỦA {selectedProvinceDash.unit?.name?.toUpperCase()}
                </h3>

                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm Xã, Phường..."
                    value={searchCommune}
                    onChange={(e) => setSearchCommune(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border bg-[#1E293B] border-slate-700 text-white outline-none"
                  />
                </div>
              </div>

              {loadingCommunes ? (
                <div className="flex justify-center py-12 text-slate-400 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Đang tải danh sách Xã Phường...</span>
                </div>
              ) : filteredCommunes.length === 0 ? (
                <div className="text-center py-12 bg-[#111827] rounded-xl border border-slate-800 text-slate-400">
                  Không tìm thấy Dashboard Xã/Phường nào trực thuộc Tỉnh này.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCommunes.map((comm) => (
                    <Link
                      key={comm.id}
                      href={`/dashboard/${comm.id}`}
                      className="group p-4 rounded-xl border bg-[#1E293B]/40 border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            {comm.unit?.type || 'COMMUNE'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            ID: {comm.id.substring(0, 8)}...
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-white group-hover:text-cyan-400 transition-colors mb-1">
                          {comm.title}
                        </h4>
                      </div>
                      <div className="text-xs text-cyan-500 font-medium mt-3 flex items-center justify-between">
                        <span>Xem chi tiết dashboard</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (

          /* ================= PHẦN 2: DANH SÁCH TỈNH BAN ĐẦU ================= */
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm Dashboard Tỉnh..."
                  value={searchProvince}
                  onChange={(e) => setSearchProvince(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 text-sm rounded-lg border outline-none ${
                    isDarkMode ? 'bg-[#1E293B] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="text-sm text-slate-400">
                Tổng số: <strong className="text-cyan-400">{filteredProvinces.length}</strong> Dashboard Tỉnh
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20 text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Đang tải danh sách Tỉnh...</span>
              </div>
            ) : filteredProvinces.length === 0 ? (
              <div className={`text-center py-16 rounded-xl border ${isDarkMode ? 'border-slate-800 bg-[#111827]' : 'border-slate-200 bg-white'}`}>
                <Building2 className="w-12 h-12 mx-auto text-slate-500 mb-3" />
                <h3 className="text-base font-semibold mb-1">Chưa có Dashboard Tỉnh nào</h3>
                <p className="text-sm text-slate-400">Nhấn "Tạo dashboard tỉnh" để khởi tạo dữ liệu.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProvinces.map((dash) => (
                  <div
                    key={dash.id}
                    onClick={() => handleSelectProvince(dash)}
                    className={`group relative p-6 rounded-xl border cursor-pointer transition-all ${
                      isDarkMode ? 'bg-[#1E293B]/60 border-slate-800 hover:border-cyan-500/50 hover:shadow-cyan-500/10' : 'bg-white border-slate-200 hover:border-cyan-500 hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {dash.unit?.type || 'PROVINCE'}
                      </span>

                      {/* Nút Sửa & Xóa */}
                      <div className="flex items-center gap-1 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDash(dash);
                            setEditTitle(dash.title);
                            setEditDomain(dash.domain_link || '');
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                          title="Sửa"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteDashboard(e, dash)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h2 className="font-bold text-lg mb-1 group-hover:text-cyan-400 transition-colors">
                      {dash.title}
                    </h2>
                    <p className="text-xs text-slate-400 mb-6">
                      Domain: {dash.domain_link || 'Hệ thống mặc định'}
                    </p>

                    <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold text-cyan-400">
                      <span>Xem danh sách Xã/Phường & Thông số tổng hợp</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL TẠO DASHBOARD TỈNH MỚI */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className="text-lg font-bold mb-4">TẠO DASHBOARD TỈNH MỚI</h3>
            <form onSubmit={handleCreateProvince} className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Chọn Tỉnh / Thành phố (34 đơn vị sau sáp nhập)
                </label>
                <div
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border flex items-center justify-between cursor-pointer ${
                    isDarkMode ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <span className={selectedProvinceUnit ? 'font-medium' : 'text-slate-400'}>
                    {selectedProvinceUnit ? selectedProvinceUnit.name : '-- Tìm & Chọn Tỉnh/Thành phố --'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>

                {isDropdownOpen && (
                  <div className={`absolute top-full left-0 w-full mt-1 z-20 rounded-xl border shadow-2xl p-2 max-h-60 overflow-y-auto ${
                    isDarkMode ? 'bg-[#1E293B] border-slate-700' : 'bg-white border-slate-200'
                  }`}>
                    <input
                      type="text"
                      placeholder="Gõ tên tỉnh để tìm..."
                      value={provinceSearchQuery}
                      onChange={(e) => setProvinceSearchQuery(e.target.value)}
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border outline-none mb-2 ${
                        isDarkMode ? 'bg-[#0B0F19] border-slate-700 text-white' : 'bg-slate-100 border-slate-200'
                      }`}
                      autoFocus
                    />
                    {availableProvinces
                      .filter((p) => p.name.toLowerCase().includes(provinceSearchQuery.toLowerCase()))
                      .map((prov) => (
                        <div
                          key={prov.id}
                          onClick={() => {
                            setSelectedProvinceUnit(prov);
                            setIsDropdownOpen(false);
                            setProvinceSearchQuery('');
                          }}
                          className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer ${
                            selectedProvinceUnit?.id === prov.id ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'hover:bg-slate-800'
                          }`}
                        >
                          <span>{prov.name}</span>
                          {selectedProvinceUnit?.id === prov.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Domain Tùy chỉnh (Nếu có)</label>
                <input
                  type="text"
                  placeholder="kinhteso.kiengiang.gov.vn"
                  value={domainLink}
                  onChange={(e) => setDomainLink(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-lg border outline-none ${
                    isDarkMode ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  {submitting ? 'Đang khởi tạo...' : 'Tạo Dashboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SỬA DASHBOARD */}
      {editingDash && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className="text-lg font-bold mb-4">CHỈNH SỬA DASHBOARD TỈNH</h3>
            <form onSubmit={handleUpdateDashboard} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tiêu đề Dashboard</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-lg border outline-none ${
                    isDarkMode ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Domain Link Tùy chỉnh</label>
                <input
                  type="text"
                  value={editDomain}
                  onChange={(e) => setEditDomain(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-lg border outline-none ${
                    isDarkMode ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDash(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}