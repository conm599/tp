// Cloudflare Workers D1数据库请求中转服务
export default {
  async fetch(request, env, ctx) {
    // 处理跨域请求
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    try {
      // 只允许POST请求
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({
          success: false,
          error: '只支持POST请求'
        }), {
          status: 405,
          headers: getCorsHeaders(request.headers.get('Origin'))
        });
      }

      // 解析请求体
      const body = await request.json();
      
      // 验证必要参数
      if (!body.action || !body.query) {
        return new Response(JSON.stringify({
          success: false,
          error: '缺少必要参数（action或query）'
        }), {
          status: 400,
          headers: getCorsHeaders(request.headers.get('Origin'))
        });
      }

      // 处理数据库操作
      let result;
      switch (body.action) {
        case 'exec':
          // 执行非查询操作（INSERT, UPDATE, DELETE等）
          result = await env.db.prepare(body.query)
            .bind(...(body.params || []))
            .run();
          break;
          
        case 'all':
          // 获取所有查询结果
          result = await env.db.prepare(body.query)
            .bind(...(body.params || []))
            .all();
          break;
          
        case 'get':
          // 获取单个查询结果
          result = await env.db.prepare(body.query)
            .bind(...(body.params || []))
            .get();
          break;
          
        default:
          return new Response(JSON.stringify({
            success: false,
            error: `不支持的操作: ${body.action}`
          }), {
            status: 400,
            headers: getCorsHeaders(request.headers.get('Origin'))
          });
      }

      // 返回成功响应
      return new Response(JSON.stringify({
        success: true,
        data: result
      }), {
        headers: getCorsHeaders(request.headers.get('Origin'))
      });

    } catch (error) {
      // 处理错误
      console.error('数据库操作错误:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || '数据库操作失败'
      }), {
        status: 500,
        headers: getCorsHeaders(request.headers.get('Origin'))
      });
    }
  },
};

// 处理OPTIONS请求
function handleOptions(request) {
  const origin = request.headers.get('Origin');
  return new Response(null, {
    headers: {
      ...getCorsHeaders(origin),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

// 获取CORS头
function getCorsHeaders(origin) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // 允许所有来源访问（开发环境用，生产环境建议限制）
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  
  return headers;
}
    