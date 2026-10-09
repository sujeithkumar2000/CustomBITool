import React, { useEffect, useState, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { Responsive as ResponsiveGridLayout } from 'react-grid-layout';
import axios from 'axios';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './App.css';

const TABLE_COLUMNS = [
  { name: 'agent_name', type: 'dimension', label: 'Agent Name' },
  { name: 'call_duration', type: 'metric', label: 'Call Duration' },
  { name: 'customer_phone', type: 'dimension', label: 'Customer Phone' },
  { name: 'disposition', type: 'dimension', label: 'Call Disposition' },
];

const AGG_FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];

function App() {
  const [widgets, setWidgets] = useState([]);
  const [defaultChartData, setDefaultChartData] = useState([]);
  const [dynamicDataMap, setDynamicDataMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Add-on Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('New Custom Report');
  const [chartType, setChartType] = useState('pie');
  const [metricColumn, setMetricColumn] = useState('call_duration');
  const [dimensionColumn, setDimensionColumn] = useState('agent_name');
  const [groupColumn, setGroupColumn] = useState('disposition');
  const [aggFunction, setAggFunction] = useState('COUNT');
  const [filterColumn, setFilterColumn] = useState('');
  const [filterValue, setFilterValue] = useState('');

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > 0) setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch both initial default API & dynamic saved widgets
  const loadBIDashboard = async () => {
    try {
      // 1. Existing working endpoints
      const widgetRes = await axios.get('http://localhost:3000/api/widgets');
      setWidgets(widgetRes.data);

      const analyticsRes = await axios.get('http://localhost:3000/api/analytics/calls-by-agent');
      setDefaultChartData(analyticsRes.data);

      // 2. Fetch data for additional created widgets
      const dataMap = {};
      for (let w of widgetRes.data) {
        if (w.config && Object.keys(w.config).length > 0) {
          const res = await axios.post('http://localhost:3000/api/analytics/query', {
            chartType: w.chart_type,
            ...w.config,
          });
          dataMap[w.id] = res.data;
        }
      }
      setDynamicDataMap(dataMap);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBIDashboard();
  }, []);

  // Generate options for standard vs dynamic widgets
  const getChartOptions = (widget) => {
    // If it's a dynamic pie chart created via add-on
    if (widget.chart_type === 'pie') {
      const data = dynamicDataMap[widget.id] || [];
      return {
        title: { text: widget.title, left: 'center' },
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        series: [
          {
            name: widget.title,
            type: 'pie',
            radius: '55%',
            data: data.map((d) => ({ name: d.name || 'Unknown', value: d.value || 0 })),
          },
        ],
      };
    }

    // Default Bar Chart logic for existing widget
    const agents = defaultChartData.map((d) => d.agent_name || 'Unknown');
    const totalCalls = defaultChartData.map((d) => d.total_calls || 0);

    return {
      title: { text: widget.title || 'Calls by Agent', subtext: 'Live ClickHouse Analytics', left: 'center' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '8%', right: '8%', bottom: '15%', top: '22%', containLabel: true },
      xAxis: [{ type: 'category', data: agents, axisTick: { alignWithLabel: true } }],
      yAxis: [{ type: 'value', name: 'Total Calls' }],
      series: [
        {
          name: 'Calls',
          type: 'bar',
          barWidth: '40%',
          data: totalCalls,
          itemStyle: { color: '#5470C6', borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  };

  const handleResize = () => {
    if (chartRef.current) {
      const echartsInstance = chartRef.current.getEchartsInstance();
      echartsInstance.resize();
    }
  };

  const handleSaveWidget = async (e) => {
    e.preventDefault();
    const newWidgetPayload = {
      title,
      chart_type: chartType,
      config: {
        metricColumn,
        dimensionColumn,
        groupColumn: chartType === 'stacked_bar' ? groupColumn : null,
        aggFunction,
        filterColumn,
        filterValue,
      },
      layout: { x: 0, y: 0, w: 6, h: 5 },
    };

    try {
      await axios.post('http://localhost:3000/api/widgets', newWidgetPayload);
      setIsModalOpen(false);
      loadBIDashboard(); // Refresh grid with newly appended report
    } catch (err) {
      console.error('Failed to save widget:', err);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading BI Dashboard...</div>;

  const displayWidgets = widgets.length > 0 ? widgets : [{ id: 1, title: 'Calls by Agent' }];

  const layout = displayWidgets.map((w, index) => ({
    i: w.id ? String(w.id) : String(index),
    x: (index % 2) * 6,
    y: Math.floor(index / 2) * 5,
    w: w.layout?.w ?? 6,
    h: w.layout?.h ?? 5,
    minW: 3,
    minH: 3,
  }));

  return (
    <div style={{ padding: '24px', backgroundColor: '#f4f6f9', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#1a1f36' }}>Custom BI Analytics Platform</h1>
          <p style={{ margin: '4px 0 0 0', color: '#697386' }}>
            React + ECharts Frontend | NestJS API | PostgreSQL Metadata | ClickHouse Analytics
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            backgroundColor: '#0066fe',
            color: '#fff',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          + Create New Chart
        </button>
      </header>

      {/* Grid Canvas */}
      <div ref={containerRef} style={{ width: '100%' }}>
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout, md: layout }}
          width={containerWidth}
          cols={{ lg: 12, md: 10, sm: 6 }}
          rowHeight={90}
          isDraggable
          isResizable
          onResize={handleResize}
          onResizeStop={handleResize}
        >
          {displayWidgets.map((widget, idx) => (
            <div
              key={widget.id ? String(widget.id) : String(idx)}
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                boxSizing: 'border-box',
                border: '1px solid #e3e8ee',
              }}
            >
              <div style={{ flex: 1, width: '100%', height: '100%' }}>
                <ReactECharts
                  ref={chartRef}
                  option={getChartOptions(widget)}
                  style={{ height: '100%', width: '100%' }}
                />
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>

      {/* ADD-ON REPORT BUILDER MODAL */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>+ Add New Chart Widget</h3>
            <form onSubmit={handleSaveWidget}>
              <label style={labelStyle}>Report Title:</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} required />

              <label style={labelStyle}>Chart Type:</label>
              <select value={chartType} onChange={(e) => setChartType(e.target.value)} style={inputStyle}>
                <option value="pie">Pie Chart (1 Dimension, 1 Metric)</option>
                <option value="bar">Bar Chart (2 Columns)</option>
                <option value="line">Line Chart (2 Columns)</option>
              </select>

              <fieldset style={fieldsetStyle}>
                <legend style={{ fontWeight: 'bold' }}>Metrics & Dimensions</legend>
                <label style={labelStyle}>Category / Dimension Column:</label>
                <select value={dimensionColumn} onChange={(e) => setDimensionColumn(e.target.value)} style={inputStyle}>
                  {TABLE_COLUMNS.map((col) => (
                    <option key={col.name} value={col.name}>{col.label}</option>
                  ))}
                </select>

                <label style={labelStyle}>Target Metric Column:</label>
                <select value={metricColumn} onChange={(e) => setMetricColumn(e.target.value)} style={inputStyle}>
                  {TABLE_COLUMNS.map((col) => (
                    <option key={col.name} value={col.name}>{col.label}</option>
                  ))}
                </select>

                <label style={labelStyle}>Aggregation Function:</label>
                <select value={aggFunction} onChange={(e) => setAggFunction(e.target.value)} style={inputStyle}>
                  {AGG_FUNCTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </fieldset>

              <fieldset style={fieldsetStyle}>
                <legend style={{ fontWeight: 'bold' }}>Filters (Optional)</legend>
                <label style={labelStyle}>Filter Column:</label>
                <select value={filterColumn} onChange={(e) => setFilterColumn(e.target.value)} style={inputStyle}>
                  <option value="">-- No Filter --</option>
                  {TABLE_COLUMNS.map((col) => (
                    <option key={col.name} value={col.name}>{col.label}</option>
                  ))}
                </select>

                {filterColumn && (
                  <>
                    <label style={labelStyle}>Filter Value (Contains):</label>
                    <input
                      type="text"
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                      style={inputStyle}
                      placeholder="e.g. John"
                    />
                  </>
                )}
              </fieldset>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={btnCancel}>Cancel</button>
                <button type="submit" style={btnSubmit}>Generate & Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle = { backgroundColor: '#fff', padding: '24px', borderRadius: '12px', width: '480px', maxHeight: '90vh', overflowY: 'auto' };
const labelStyle = { display: 'block', margin: '8px 0 4px 0', fontSize: '14px', color: '#333' };
const inputStyle = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' };
const fieldsetStyle = { border: '1px solid #ddd', borderRadius: '8px', padding: '12px', margin: '12px 0' };
const btnCancel = { padding: '10px 16px', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer', background: '#fff' };
const btnSubmit = { padding: '10px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#0066fe', color: '#fff', cursor: 'pointer' };

export default App;