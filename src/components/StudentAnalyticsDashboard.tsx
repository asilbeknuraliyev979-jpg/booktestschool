import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Users,
  Award,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { StudentTestResult, TestDeliveryConfig } from '../types';

interface StudentAnalyticsDashboardProps {
  results: StudentTestResult[];
  deliveryConfig: TestDeliveryConfig;
}

const GRADE_COLORS: Record<string, string> = {
  "5 (A'lo)": '#10b981', // Emerald
  "4 (Yaxshi)": '#3b82f6', // Blue
  "3 (Qoniqarli)": '#f59e0b', // Amber
  "2 (Qoniqarsiz)": '#ef4444', // Red
};

export const StudentAnalyticsDashboard: React.FC<StudentAnalyticsDashboardProps> = ({
  results,
  deliveryConfig,
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'all' | 'books' | 'grades'>('all');

  // 1. KPI Aggregations
  const totalStudents = results.length;
  const avgPercentage =
    totalStudents > 0
      ? Math.round(results.reduce((acc, r) => acc + r.percentage, 0) / totalStudents)
      : 0;

  const g5Threshold = deliveryConfig.grade5Threshold || 86;
  const g4Threshold = deliveryConfig.grade4Threshold || 71;
  const g3Threshold = deliveryConfig.grade3Threshold || 56;

  const topPerformersCount = results.filter((r) => r.percentage >= g5Threshold).length;
  const goodPerformersCount = results.filter(
    (r) => r.percentage >= g4Threshold && r.percentage < g5Threshold
  ).length;
  const satisfactoryCount = results.filter(
    (r) => r.percentage >= g3Threshold && r.percentage < g4Threshold
  ).length;
  const lowCount = results.filter((r) => r.percentage < g3Threshold).length;

  // 2. Book Performance Aggregations (Recharts BarChart)
  const bookChartData = useMemo(() => {
    const map: Record<
      string,
      { totalScore: number; count: number; maxScore: number; mcCorrect: number; mcTotal: number; writtenCorrect: number; writtenTotal: number }
    > = {};

    results.forEach((r) => {
      if (!map[r.bookTitle]) {
        map[r.bookTitle] = {
          totalScore: 0,
          count: 0,
          maxScore: 0,
          mcCorrect: 0,
          mcTotal: 0,
          writtenCorrect: 0,
          writtenTotal: 0,
        };
      }
      map[r.bookTitle].count += 1;
      map[r.bookTitle].totalScore += r.percentage;
      if (r.percentage > map[r.bookTitle].maxScore) {
        map[r.bookTitle].maxScore = r.percentage;
      }
      map[r.bookTitle].mcCorrect += r.multipleChoiceCorrect || 0;
      map[r.bookTitle].mcTotal += r.multipleChoiceTotal || 0;
      map[r.bookTitle].writtenCorrect += r.writtenCorrect || 0;
      map[r.bookTitle].writtenTotal += r.writtenTotal || 0;
    });

    return Object.entries(map).map(([title, stats]) => ({
      shortTitle: title.length > 14 ? title.slice(0, 13) + '…' : title,
      fullName: title,
      avgScore: Math.round(stats.totalScore / stats.count),
      students: stats.count,
      maxScore: stats.maxScore,
    }));
  }, [results]);

  // 3. Grade/Class Performance Aggregations (Recharts Bar/LineChart)
  const gradeChartData = useMemo(() => {
    const map: Record<string, { totalScore: number; count: number }> = {};

    results.forEach((r) => {
      const g = (r.studentGrade || "Boshqa").trim();
      if (!map[g]) map[g] = { totalScore: 0, count: 0 };
      map[g].count += 1;
      map[g].totalScore += r.percentage;
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([grade, stats]) => ({
        grade,
        avgScore: Math.round(stats.totalScore / stats.count),
        students: stats.count,
      }));
  }, [results]);

  // 4. Grade Distribution Data (PieChart)
  const gradeDistributionData = useMemo(() => {
    return [
      { name: "5 (A'lo)", count: topPerformersCount, color: GRADE_COLORS["5 (A'lo)"] },
      { name: "4 (Yaxshi)", count: goodPerformersCount, color: GRADE_COLORS["4 (Yaxshi)"] },
      { name: "3 (Qoniqarli)", count: satisfactoryCount, color: GRADE_COLORS["3 (Qoniqarli)"] },
      { name: "2 (Qoniqarsiz)", count: lowCount, color: GRADE_COLORS["2 (Qoniqarsiz)"] },
    ].filter((item) => item.count > 0);
  }, [topPerformersCount, goodPerformersCount, satisfactoryCount, lowCount]);

  // 5. Written vs Multiple-choice comparative accuracy
  const totalMCGiven = results.reduce((acc, r) => acc + (r.multipleChoiceTotal || 0), 0);
  const totalMCCorrect = results.reduce((acc, r) => acc + (r.multipleChoiceCorrect || 0), 0);
  const mcAccuracy = totalMCGiven > 0 ? Math.round((totalMCCorrect / totalMCGiven) * 100) : 0;

  const totalWrittenGiven = results.reduce((acc, r) => acc + (r.writtenTotal || 0), 0);
  const totalWrittenCorrect = results.reduce((acc, r) => acc + (r.writtenCorrect || 0), 0);
  const writtenAccuracy = totalWrittenGiven > 0 ? Math.round((totalWrittenCorrect / totalWrittenGiven) * 100) : 0;

  if (results.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
          <BarChart3 className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-800">
          Grafik tahlil uchun ma'lumotlar kutilmoqda
        </h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          O'quvchilar test topshirgach, ushbu bo'limda kitoblar reytingi, sinflar kesimidagi o'zlashtirish va baholar dinamikasi interaktiv grafiklar orqali aks ettiriladi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs for Charts */}
      <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-bold text-slate-900">
            O'quvchilar Ko'rsatkichlari Tahlili (Recharts Dashboard)
          </h3>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveChartTab('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeChartTab === 'all'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Barchasi
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('books')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeChartTab === 'books'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Kitoblar kesimida
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('grades')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeChartTab === 'grades'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sinflar kesimida
          </button>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Average Scores Per Book */}
        {(activeChartTab === 'all' || activeChartTab === 'books') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Kitoblar bo'yicha o'rtacha o'zlashtirish (%)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Har bir asar bo'yicha o'quvchilar erishgan o'rtacha ballar
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                {bookChartData.length} ta kitob
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={bookChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="shortTitle"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg text-xs space-y-1">
                            <p className="font-bold text-blue-300">{data.fullName}</p>
                            <p>O'rtacha o'zlashtirish: <strong className="text-emerald-400">{data.avgScore}%</strong></p>
                            <p>Topshirgan o'quvchilar: <strong>{data.students} nafar</strong></p>
                            <p>Eng yuqori natija: <strong>{data.maxScore}%</strong></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="avgScore"
                    name="O'rtacha ball (%)"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CHART 2: Average Scores Per Grade / Class */}
        {(activeChartTab === 'all' || activeChartTab === 'grades') && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Sinflar kesimida o'quvchilar bilimi (%)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sinflar bo'yicha o'rtacha ko'rsatkich va faollik
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
                {gradeChartData.length} ta sinf
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={gradeChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="grade"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg text-xs space-y-1">
                            <p className="font-bold text-indigo-300">{data.grade}</p>
                            <p>O'rtacha natija: <strong className="text-emerald-400">{data.avgScore}%</strong></p>
                            <p>Topshirganlar soni: <strong>{data.students} nafar</strong></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="avgScore"
                    name="O'rtacha foiz (%)"
                    fill="#6366f1"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CHART 3: Grade Distribution (Donut PieChart) */}
        {activeChartTab === 'all' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-emerald-600" />
                  <span>Baholar Taqsimoti (5, 4, 3, 2)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Maktab o'quvchilarining baholar mutanosibligi
                </p>
              </div>
            </div>

            <div className="h-64 w-full flex flex-col sm:flex-row items-center justify-center gap-4">
              <div className="w-48 h-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={gradeDistributionData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {gradeDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          const pct = Math.round((item.count / totalStudents) * 100);
                          return (
                            <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg text-xs space-y-0.5">
                              <p className="font-bold">{item.name}</p>
                              <p>O'quvchilar: <strong>{item.count} nafar</strong> ({pct}%)</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend List */}
              <div className="space-y-2 text-xs w-full max-w-xs">
                {gradeDistributionData.map((item) => {
                  const pct = Math.round((item.count / totalStudents) * 100);
                  return (
                    <div
                      key={item.name}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-slate-800">{item.name}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-600">
                        {item.count} nafar ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* CHART 4: Question Type Mastery (Variantli vs Yozma) */}
        {activeChartTab === 'all' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Savol Turlari Bo'yicha Aniqlik</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Variantli testlar va AI tomonidan baholangan yozma javoblar samaradorligi
              </p>
            </div>

            <div className="h-64 flex flex-col justify-center space-y-6 px-4">
              {/* Multiple Choice Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-blue-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span>Variantli testlar aniqligi</span>
                  </span>
                  <span className="font-mono font-bold text-blue-700">{mcAccuracy}%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${mcAccuracy}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-2xs text-slate-400">
                  <span>To'g'ri: {totalMCCorrect} ta</span>
                  <span>Jami berilgan: {totalMCGiven} ta</span>
                </div>
              </div>

              {/* Written Answers Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-indigo-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                    <span>Yozma tahliliy javoblar aniqligi (AI tahlili)</span>
                  </span>
                  <span className="font-mono font-bold text-indigo-700">{writtenAccuracy}%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${writtenAccuracy}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-2xs text-slate-400">
                  <span>Qabul qilingan: {totalWrittenCorrect} ta</span>
                  <span>Jami yozilgan: {totalWrittenGiven} ta</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
