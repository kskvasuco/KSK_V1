import React, { useState, useEffect } from 'react';
import styles from './adminStyles.module.css';

// --- CUSTOM SVG ICONS ---
const TrendingUpIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
);
const TrendingDownIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
    </svg>
);
const ShoppingCartIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
);
const UsersIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);
const PackageIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
);

// --- CUSTOM SVG CHARTS ---
const SimpleAreaChart = ({ data, width = 600, height = 240 }) => {
    if (!data || data.length === 0) return null;
    const padding = 30;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxVal = Math.max(...data.map(d => d.revenue), 1);
    const stepX = chartWidth / (data.length - 1 || 1);

    const points = data.map((d, i) => ({
        x: padding + i * stepX,
        y: height - padding - (d.revenue / maxVal) * chartHeight
    }));

    const pathData = points.reduce((acc, p, i) => 
        acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), "");

    const areaPath = pathData + ` L ${points[points.length-1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#11998e" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#11998e" stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* Grid */}
            {[0, 0.5, 1].map((p, i) => (
                <line key={i} x1={padding} y1={height - padding - p * chartHeight} x2={width - padding} y2={height - padding - p * chartHeight} stroke="#f1f5f9" strokeWidth="1" />
            ))}
            {/* Labels */}
            {data.map((d, i) => (
                <text key={i} x={padding + i * stepX} y={height - 5} textAnchor="middle" fontSize="10" fill="#94a3b8">{d.name}</text>
            ))}
            {/* Area */}
            <path d={areaPath} fill="url(#areaGradient)" />
            {/* Line */}
            <path d={pathData} fill="none" stroke="#11998e" strokeWidth="2.5" />
            {/* Dots */}
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="white" stroke="#11998e" strokeWidth="2" />
            ))}
        </svg>
    );
};

const SimplePieChart = ({ data, size = 160 }) => {
    if (!data || data.length === 0) return null;
    const total = data.reduce((acc, d) => acc + d.value, 0);
    let cumulativePercent = 0;

    const colors = ['#11998e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];

    function getCoordinatesForPercent(percent) {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    }

    return (
        <svg width={size} height={size} viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)', margin: 'auto' }}>
            {data.map((slice, i) => {
                const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
                cumulativePercent += slice.value / total;
                const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
                const largeArcFlag = slice.value / total > 0.5 ? 1 : 0;
                const pathData = [
                    `M ${startX} ${startY}`,
                    `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                    'L 0 0',
                ].join(' ');

                return <path key={i} d={pathData} fill={colors[i % colors.length]} stroke="white" strokeWidth="0.02" />;
            })}
            <circle cx="0" cy="0" r="0.7" fill="white" />
        </svg>
    );
};

function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const res = await fetch('/api/admin/analytics');
                if (!res.ok) throw new Error('Failed to fetch analytics');
                const result = await res.json();
                setData(result);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    if (loading) return (
        <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Gathering business insights...</p>
        </div>
    );

    if (error) return <div className={styles.errorMessage}>{error}</div>;

    // Helper to render standard Rupee symbol
    const Rupee = () => <span className={styles.rupee}>₹</span>;

    const kpis = [
        { 
            label: 'Lifetime Revenue', 
            value: <>{Rupee()}{data.summary.lifetimeRevenue.toLocaleString()}</>, 
            icon: TrendingUpIcon, 
            bg: '#e6f7f0',
            color: '#11998e',
            sub: [
                { label: 'Avg/Month', value: <>{Rupee()}{data.summary.avgMonthlyRevenue.toLocaleString()}</> },
                { label: 'Avg/Year', value: <>{Rupee()}{data.summary.avgYearlyRevenue.toLocaleString()}</> }
            ]
        },
        { 
            label: 'Active Orders', 
            value: data.summary.activeOrders, 
            icon: ShoppingCartIcon, 
            bg: '#eff6ff',
            color: '#3b82f6',
            badge: data.summary.momGrowth,
            sub: [
                { label: 'Growth', value: `${data.summary.momGrowth >= 0 ? '+' : ''}${data.summary.momGrowth}%` }
            ]
        },
        { 
            label: 'Customers', 
            value: data.summary.totalUsers.toLocaleString(), 
            icon: UsersIcon, 
            bg: '#f5f3ff',
            color: '#8b5cf6'
        },
        { 
            label: 'Period Sales', 
            value: <>{Rupee()}{data.summary.periodRevenue.toLocaleString()}</>, 
            icon: PackageIcon, 
            bg: '#fffbeb',
            color: '#f59e0b'
        }
    ];

    const COLORS = ['#11998e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];

    return (
        <div className={styles.dashboardContainer}>
            <div className={styles.dashboardHeader}>
                <h1 className={styles.greetingTitle}>Hai KSK Vasu ..! 👋</h1>
                <p className={styles.greetingText}>Welcome back! Here's what's happening with your business today.</p>
            </div>

            {/* KPI Cards */}
            <div className={styles.statsGrid}>
                {kpis.map((kpi, idx) => (
                    <div key={idx} className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <div className={styles.statIcon} style={{ background: kpi.bg, color: kpi.color }}>
                                <kpi.icon size={22} />
                            </div>
                            {kpi.badge !== undefined && (
                                <div className={`${styles.statBadge} ${kpi.badge >= 0 ? styles.badgePositive : styles.badgeNegative}`}>
                                    {kpi.badge >= 0 ? <TrendingUpIcon size={12} /> : <TrendingDownIcon size={12} />}
                                    {Math.abs(kpi.badge)}%
                                </div>
                            )}
                        </div>
                        <div className={styles.statMain}>
                            <span className={styles.statValue}>{kpi.value}</span>
                            <span className={styles.statLabel}>{kpi.label}</span>
                        </div>
                        {kpi.sub && (
                            <div className={styles.statFooter}>
                                {kpi.sub.map((s, i) => (
                                    <div key={i} className={styles.subMetric}>
                                        <span className={styles.subMetricValue}>{s.value}</span>
                                        <span className={styles.subMetricLabel}>{s.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Charts Grid */}
            <div className={styles.chartsGrid}>
                {/* Sales Trend Chart */}
                <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>
                        <span>Sales Velocity (6M)</span>
                        <div className={styles.chartLegend}>
                            <div className={styles.legendItem}>
                                <div className={styles.legendDot} style={{ background: '#11998e' }}></div>
                                Revenue
                            </div>
                        </div>
                    </div>
                    <div style={{ padding: '10px 0' }}>
                        <SimpleAreaChart data={data.salesTrend} />
                    </div>
                </div>

                {/* Status Distribution */}
                <div className={`${styles.chartCard} ${styles.glassCard}`}>
                    <div className={styles.chartTitle}>Order Distribution</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '10px 0' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <SimplePieChart data={data.statusDistribution} size={180} />
                            <div style={{ position: 'absolute', textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Total</span>
                                <span style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>
                                    {data.statusDistribution.reduce((acc, d) => acc + d.value, 0)}
                                </span>
                            </div>
                        </div>
                        
                        <div className={styles.orderStatusList}>
                             {data.statusDistribution.map((item, idx) => (
                                 <div key={idx} className={styles.orderStatusItem}>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                         <div className={styles.statusIndicator} style={{ background: COLORS[idx % COLORS.length], color: COLORS[idx % COLORS.length] }}></div>
                                         <span className={styles.orderStatusName}>{item.name}</span>
                                     </div>
                                     <span className={styles.orderStatusValue}>{item.value}</span>
                                 </div>
                             ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Products Table */}
            <div className={styles.chartCard}>
                <div className={styles.chartTitle}>
                    Top Selling Products
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '400' }}>By Revenue</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className={styles.compactTable}>
                        <thead>
                            <tr>
                                <th>Product Name</th>
                                <th>Quantity Sold</th>
                                <th>Revenue Generated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.topProducts.map((p, idx) => (
                                <tr key={idx}>
                                    <td style={{ fontWeight: '500' }}>{p.name}</td>
                                    <td>{p.qty} Units</td>
                                    <td style={{ color: '#11998e' }}><span className={styles.rupee}>₹</span><span style={{ fontWeight: '700' }}>{p.revenue.toLocaleString()}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
