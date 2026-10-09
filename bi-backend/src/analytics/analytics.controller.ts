import { Body, Controller, Get, Post } from '@nestjs/common';
import { PostgresService } from '../database/postgres/postgres.service.js';
import { ClickhouseService } from '../database/clickhouse/clickhouse.service.js';

@Controller('api')
export class AnalyticsController {
  constructor(
    private readonly postgresService: PostgresService,
    private readonly clickhouseService: ClickhouseService,
  ) {}

  @Get('widgets')
  async getWidgets() {
    const result = await this.postgresService.query(
      'SELECT id, tenant_id, title, chart_type, config, layout FROM dashboard_widgets WHERE tenant_id = $1',
      ['tenant_1'],
    );
    return result.rows;
  }

  @Get('analytics/calls-by-agent')
  async getCallsByAgent() {
    const query = `
      SELECT 
        agent_name, 
        count() AS total_calls,
        round(avg(toInt32OrZero(toString(duration))), 2) AS avg_duration
      FROM flat_call_analytics
      GROUP BY agent_name
      ORDER BY total_calls DESC
    `;
    const data = await this.clickhouseService.query(query);
    return data;
  }
  @Post('widgets')
async createWidget(@Body() body: any) {
  const { title, chart_type, config, layout } = body;
  const tenantId = 'tenant_1';

  const query = `
    INSERT INTO dashboard_widgets (tenant_id, title, chart_type, config, layout)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const result = await this.postgresService.query(query, [
    tenantId,
    title,
    chart_type,
    JSON.stringify(config || {}),
    JSON.stringify(layout || { x: 0, y: 0, w: 6, h: 5 }),
  ]);

  return result.rows[0];
}

// 2. Add-on Endpoint: Execute dynamic query based on chart type & metric selection
@Post('analytics/query')
async runDynamicQuery(@Body() body: any) {
  const { chartType, metricColumn, dimensionColumn, groupColumn, aggFunction, filterColumn, filterValue } = body;

  let selectClause = '';
  let groupByClause = '';
  let whereClause = filterColumn && filterValue ? `WHERE toString(${filterColumn}) LIKE '%${filterValue}%'` : '';

  const aggFunc = aggFunction || 'COUNT';
  const metricExpr = aggFunc === 'COUNT' ? 'count()' : `${aggFunc}(toInt32OrZero(toString(${metricColumn || 'call_duration'})))`;

  if (chartType === 'pie') {
    const dim = dimensionColumn || 'agent_name';
    selectClause = `${dim} AS name, round(${metricExpr}, 2) AS value`;
    groupByClause = `GROUP BY ${dim}`;
  } else if (chartType === 'stacked_bar') {
    const dim = dimensionColumn || 'agent_name';
    const grp = groupColumn || 'disposition';
    selectClause = `${dim} AS category, ${grp} AS series_group, round(${metricExpr}, 2) AS value`;
    groupByClause = `GROUP BY ${dim}, ${grp}`;
  } else {
    const dim = dimensionColumn || 'agent_name';
    selectClause = `${dim} AS x_axis, round(${metricExpr}, 2) AS y_axis`;
    groupByClause = `GROUP BY ${dim}`;
  }

  const sqlQuery = `
    SELECT ${selectClause}
    FROM flat_call_analytics
    ${whereClause}
    ${groupByClause}
    LIMIT 100
  `;

  try {
    const data = await this.clickhouseService.query(sqlQuery);
    return data;
  } catch (err) {
    console.error('Dynamic Query Error:', err);
    return [];
  }
}
}