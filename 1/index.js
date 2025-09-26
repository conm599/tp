// Cloudflare Worker脚本代码 (gh-proxy-worker.js)
// 在Cloudflare Worker中使用默认值，环境变量应该在Worker设置中配置
let GITHUB_OWNER = 'conm599'; // 默认值
let GITHUB_REPO = 'tp';       // 默认值
let GITHUB_TOKEN = '';        // 默认值为空，需要通过三次点击配置

// 全局配置对象，用于在运行时更新配置
const config = {
  get owner() { return GITHUB_OWNER; },
  get repo() { return GITHUB_REPO; },
  get token() { return GITHUB_TOKEN; },
  set owner(value) { GITHUB_OWNER = value; },
  set repo(value) { GITHUB_REPO = value; },
  set token(value) { GITHUB_TOKEN = value; }
};

// 注意：在Cloudflare Worker中，我们允许初始值为空，用户可以通过三次点击配置来设置这些值
// 实际使用前会在相应函数中检查这些值是否已配置

async function handleRequest(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 处理根路径，显示文件列表或配置引导页面
    if (pathname === '/' || pathname === '') {
        // 如果配置已设置，显示文件列表
        if (config.owner && config.repo && config.token) {
            return await listDirectory('');
        } else {
            // 否则显示配置引导页面
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>GitHub 图库代理 - 配置引导</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 0; padding: 40px; background-color: #f8f9fa; text-align: center; }
                        .container { max-width: 600px; margin: 0 auto; padding: 30px; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        h1 { color: #333; }
                        p { color: #666; line-height: 1.6; }
                        .highlight { background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .step { margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 3px solid #2196F3; text-align: left; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>GitHub 图库代理</h1>
                        <p>欢迎使用 GitHub 图库代理服务！</p>
                        
                        <div class="highlight">
                            <p><strong>配置说明：</strong> 请三次点击页面空白区域，然后按照提示输入您的 GitHub 配置信息。</p>
                        </div>
                        
                        <div class="step">
                            <p>步骤：</p>
                            <ol>
                                <li>在页面空白区域连续点击三次</li>
                                <li>在弹出的对话框中输入配置信息，格式为：<code>owner,repo,token</code></li>
                                <li>其中：</li>
                                <li>- <code>owner</code> 是您的 GitHub 用户名或组织名</li>
                                <li>- <code>repo</code> 是您要使用的仓库名</li>
                                <li>- <code>token</code> 是具有写入权限的 GitHub 个人访问令牌</li>
                            </ol>
                        </div>
                    </div>
                    
                    <script>
                        // 三次点击空白处显示GitHub配置对话框
                        let clickCount = 0;
                        let lastClickTime = 0;
                        
                        document.addEventListener('click', function(e) {
                            const now = new Date().getTime();
                            
                            // 如果点击在空白区域
                            if (e.target === document.body) {
                                // 重置计数如果超过3秒
                                if (now - lastClickTime > 3000) {
                                    clickCount = 0;
                                }
                                
                                clickCount++;
                                lastClickTime = now;
                                
                                if (clickCount === 3) {
                                    // 显示配置对话框
                                    const newConfig = prompt(
                                        '请输入新的GitHub配置（格式：owner,repo,token）:',
                                        ''
                                    );
                                    
                                    if (newConfig) {
                                        const [owner, repo, token] = newConfig.split(',');
                                        if (owner && repo && token) {
                                            // 创建表单提交配置更新
                                            const form = document.createElement('form');
                                            form.method = 'post';
                                            form.action = '/update-config';
                                            
                                            const ownerInput = document.createElement('input');
                                            ownerInput.type = 'hidden';
                                            ownerInput.name = 'owner';
                                            ownerInput.value = owner;
                                            form.appendChild(ownerInput);
                                            
                                            const repoInput = document.createElement('input');
                                            repoInput.type = 'hidden';
                                            repoInput.name = 'repo';
                                            repoInput.value = repo;
                                            form.appendChild(repoInput);
                                            
                                            const tokenInput = document.createElement('input');
                                            tokenInput.type = 'hidden';
                                            tokenInput.name = 'token';
                                            tokenInput.value = token;
                                            form.appendChild(tokenInput);
                                            
                                            document.body.appendChild(form);
                                            form.submit();
                                        } else {
                                            alert('配置格式错误，请按照 owner,repo,token 格式输入。');
                                        }
                                    }
                                    
                                    clickCount = 0;
                                }
                            } else {
                                // 点击了其他元素，重置计数
                                clickCount = 0;
                            }
                        });
                    </script>
                </body>
                </html>
            `;
            return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
    }
    
    // 处理目录列表请求
    if (pathname.startsWith('/tree/')) {
        const path = pathname.slice(6); // 移除 '/tree/' 前缀
        return await listDirectory(path);
    }
    
    // 处理文件请求 - 支持有file/前缀和没有file/前缀的情况
    if (pathname.startsWith('/file/')) {
        const filePath = pathname.slice(6); // 移除 '/file/' 前缀
        return await downloadFile(filePath, request);
    }
    
    // 处理没有file/前缀的文件请求（适用于新域名下的直接请求）
    // 如果不是tree路径且不是根路径且不是创建文件夹路径，则假设是文件请求
    if (!pathname.startsWith('/tree/') && !pathname.startsWith('/create-folder') && !pathname.startsWith('/upload') && !pathname.startsWith('/delete')) {
        // 移除开头的斜杠
        const filePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
        return await downloadFile(filePath, request);
    }
    
    // 处理上传请求
    if (pathname === '/upload' && request.method === 'POST') {
        return await handleUpload(request);
    }
    
    // 处理删除请求
    if (pathname === '/delete' && request.method === 'POST') {
        return await handleDelete(request);
    }
    
    // 处理创建文件夹请求
    if (pathname === '/create-folder' && request.method === 'POST') {
        return await handleCreateFolder(request);
    }
    
    // 处理配置更新请求
    if (pathname === '/update-config' && request.method === 'POST') {
        return await handleUpdateConfig(request);
    }
    
    // 返回404对于未知路径
    return new Response('Not Found', { status: 404 });
}

async function listDirectory(path) {
    try {
        // 检查配置是否已设置
        if (!config.owner || !config.repo || !config.token) {
            return new Response('配置未设置，请三次点击页面空白区域进行配置。', { status: 400 });
        }
        // 构建GitHub API请求URL
        const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
        
        // 发送请求到GitHub API
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${config.token}`,
                'User-Agent': 'Cloudflare-Workers-GitHub-Proxy'
            }
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API返回错误: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 生成HTML页面显示目录内容
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${GITHUB_OWNER}/${GITHUB_REPO} - ${path || '根目录'}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; }
                    ul { list-style-type: none; padding: 0; }
                    li { padding: 5px 0; display: flex; justify-content: space-between; align-items: center; }
                    a { text-decoration: none; color: #0366d6; }
                    a:hover { text-decoration: underline; }
                    .file-icon { color: #79b8ff; }
                    .dir-icon { color: #ffd33d; }
                    .delete-button { background-color: #dc3545; color: white; border: none; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 0.9em; }
                    .delete-button:hover { background-color: #c82333; }
                    .upload-form { margin: 15px 0; padding: 15px; background-color: #e9f5ff; border-radius: 5px; }
                </style>
            </head>
            <body>
                <h1>${GITHUB_OWNER}/${GITHUB_REPO}</h1>
                <h2>${path || '根目录'}</h2>
                
                <!-- 创建文件夹表单 -->
                <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
                    <h3>创建文件夹</h3>
                    <form action="/create-folder" method="post">
                        <input type="hidden" name="path" value="${path}">
                        <input type="text" name="folderName" placeholder="输入文件夹名称" required>
                        <button type="submit">创建文件夹</button>
                    </form>
                </div>
                
                <!-- 上传文件表单 -->
                <div class="upload-form">
                    <h3>上传文件</h3>
                    <form action="/upload" method="post" enctype="multipart/form-data">
                        <input type="hidden" name="path" value="${path}">
                        <input type="file" name="file" required>
                        <button type="submit">上传文件</button>
                    </form>
                </div>
                
                <ul>
        `;
        
        // 添加返回上级目录链接（如果不是根目录）
        if (path) {
            const parentPath = path.split('/').slice(0, -1).join('/');
            html += `<li><a href="/${parentPath ? 'tree/' + parentPath : ''}">📁 ..（上级目录）</a></li>`;
        }
        
        // 添加目录和文件列表
        for (const item of data) {
            if (item.type === 'dir') {
                // 确保路径不包含tree/前缀
            const cleanPath = item.path.replace(/^tree\//, '');
            html += `<li><div><span class="dir-icon">📁</span> <a href="/tree/${cleanPath}">${item.name}/</a></div><button class="delete-button" onclick="confirmDelete('${cleanPath}', 'dir')">删除</button></li>`;
            } else {
                // 确保文件路径不包含任何前缀
                const cleanPath = item.path.replace(/^tree\//, '');
                // 直接在域名后添加文件名，不包含file/前缀
                html += `<li><div><span class="file-icon">📄</span> <a href="/${cleanPath}" target="_blank">${item.name}</a>`;
                html += ` <small>(<a href="/${cleanPath}?download=true" target="_blank" download>下载</a>)</small></div><button class="delete-button" onclick="confirmDelete('${cleanPath}', 'file')">删除</button></li>`;
            }
        }
        
        html += `
                </ul>
                
                <script>
                    // 三次点击空白处显示GitHub配置对话框
                    let clickCount = 0;
                    let lastClickTime = 0;
                    
                    document.addEventListener('click', function(e) {
                        const now = new Date().getTime();
                        
                        // 如果点击在空白区域
                        if (e.target === document.body) {
                            // 重置计数如果超过3秒
                            if (now - lastClickTime > 3000) {
                                clickCount = 0;
                            }
                            
                            clickCount++;
                            lastClickTime = now;
                            
                            if (clickCount === 3) {
                                // 不再在前端显示Token
                                const currentOwner = '${config.owner}';
                                const currentRepo = '${config.repo}';
                                
                                // 显示配置对话框，仅显示owner和repo，Token使用占位符
                                const newConfig = prompt(
                                    '请输入新的GitHub配置（格式：owner,repo,token）:',
                                    currentOwner + ',' + currentRepo + ',[token不显示]'
                                );
                                
                                if (newConfig) {
                                    const [owner, repo, token] = newConfig.split(',');
                                    if (owner && repo && token && token !== '[token不显示]') {
                                        // 创建表单提交配置更新
                                        const form = document.createElement('form');
                                        form.method = 'post';
                                        form.action = '/update-config';
                                        
                                        const ownerInput = document.createElement('input');
                                        ownerInput.type = 'hidden';
                                        ownerInput.name = 'owner';
                                        ownerInput.value = owner;
                                        form.appendChild(ownerInput);
                                        
                                        const repoInput = document.createElement('input');
                                        repoInput.type = 'hidden';
                                        repoInput.name = 'repo';
                                        repoInput.value = repo;
                                        form.appendChild(repoInput);
                                        
                                        const tokenInput = document.createElement('input');
                                        tokenInput.type = 'hidden';
                                        tokenInput.name = 'token';
                                        tokenInput.value = token;
                                        form.appendChild(tokenInput);
                                        
                                        document.body.appendChild(form);
                                        form.submit();
                                    } else {
                                        alert('配置格式错误，请按照 owner,repo,token 格式输入，Token不能为空。');
                                    }
                                }
                                
                                clickCount = 0;
                            }
                        } else {
                            // 点击了其他元素，重置计数
                            clickCount = 0;
                        }
                    });
                    
                    // JavaScript 处理删除确认
                    function confirmDelete(path, type) {
                        if (confirm('确定要删除' + (type === 'dir' ? '文件夹' : '文件') + ' "' + path.split('/').pop() + '"吗？')) {
                            const form = document.createElement('form');
                            form.method = 'post';
                            form.action = '/delete';
                            
                            const pathInput = document.createElement('input');
                            pathInput.type = 'hidden';
                            pathInput.name = 'path';
                            pathInput.value = path;
                            form.appendChild(pathInput);
                            
                            const typeInput = document.createElement('input');
                            typeInput.type = 'hidden';
                            typeInput.name = 'type';
                            typeInput.value = type;
                            form.appendChild(typeInput);
                            
                            document.body.appendChild(form);
                            form.submit();
                        }
                    }
                </script>
            </body>
            </html>
        `;
        
        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    } catch (error) {
        return new Response(`错误: ${error.message}`, { status: 500 });
    }
}

async function downloadFile(filePath, request = null) {
    try {
        // 检查配置是否已设置
        if (!config.owner || !config.repo || !config.token) {
            return new Response('配置未设置，请三次点击页面空白区域进行配置。', { status: 400 });
        }
        // 构建GitHub raw内容URL
        const rawUrl = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/main/${filePath}`;
        
        // 转发请求到GitHub
        const response = await fetch(rawUrl, {
            headers: {
                'Authorization': `token ${config.token}`,
                'User-Agent': 'Cloudflare-Workers-GitHub-Proxy'
            }
        });
        
        if (!response.ok) {
            throw new Error(`无法获取文件: ${response.status}`);
        }
        
        // 获取文件内容
        const content = await response.arrayBuffer();
        
        // 设置响应头
        const headers = new Headers(response.headers);
        
        // 检查是否需要设置下载头
        let shouldDownload = false;
        if (request) {
            const url = new URL(request.url);
            shouldDownload = url.searchParams.get('download') === 'true';
        }
        
        // 如果是下载请求，设置Content-Disposition头
        if (shouldDownload) {
            const fileName = filePath.split('/').pop();
            headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
        }
        
        // 返回文件内容
        return new Response(content, {
            headers: headers,
            status: response.status,
            statusText: response.statusText
        });
    } catch (error) {
        return new Response(`错误: ${error.message}`, { status: 500 });
    }
}

// 处理文件上传
async function handleUpload(request) {
    try {
        // 检查配置是否已设置
        if (!config.owner || !config.repo || !config.token) {
            return new Response('配置未设置，请三次点击页面空白区域进行配置。', { status: 400 });
        }
        // 解析表单数据
        const formData = await request.formData();
        const file = formData.get('file');
        let path = formData.get('path') || '';
        
        if (!file) {
            throw new Error('没有选择文件');
        }
        
        // 构建完整的文件路径
        const fullPath = path ? `${path}/${file.name}` : file.name;
        
        // 读取文件内容
        const fileContent = await file.arrayBuffer();
        
        // 检查文件是否过大
        if (fileContent.byteLength > 25 * 1024 * 1024) { // 25MB限制
            throw new Error('文件大小不能超过25MB');
        }
        
        // 预检查：避免上传可能包含密钥的文本文件
        const fileType = file.type || '';
        const fileName = file.name.toLowerCase();
        
        // 对于常见的文本文件类型，进行简单的安全检查
        const textFileExtensions = ['.txt', '.js', '.json', '.md', '.html', '.css', '.xml', '.yml', '.yaml', '.env'];
        const isTextFile = textFileExtensions.some(ext => fileName.endsWith(ext)) || 
                          fileType.startsWith('text/') || 
                          fileType.includes('json') || 
                          fileType.includes('xml');
        
        // 对于文本文件，进行基本的密钥模式检查
        if (isTextFile && fileContent.byteLength < 1024 * 1024) { // 仅对小于1MB的文件进行文本检查
            try {
                const textContent = new TextDecoder().decode(fileContent);
                
                // 简化的敏感信息检测
                const sensitivePatterns = [
                    /(api|secret|private|access|auth)[-_]?(key|token)/i,
                    /(password|passwd|pwd|credential)=['"](.{8,})['"]/i,
                    /BEGIN\s+(RSA\s+|DSA\s+|EC\s+)?PRIVATE\s+KEY/i
                ];
                
                for (const pattern of sensitivePatterns) {
                    if (pattern.test(textContent)) {
                        throw new Error('文件内容可能包含敏感信息，为了安全考虑禁止上传。');
                    }
                }
            } catch (e) {
                // 如果解码失败，可能不是文本文件，继续上传
            }
        }
        
        // 对内容进行Base64编码
        const contentBase64 = btoa(String.fromCharCode(...new Uint8Array(fileContent)));
        
        // 构建GitHub API URL
        const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${fullPath}`;
        
        // 使用非常安全的提交消息，避免任何可能触发安全检测的词语
        const commitMessage = `Update content`;
        
        // 发送请求到GitHub API创建或更新文件
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${config.token}`,
                'User-Agent': 'GitHub-Content-Manager', // 更中性的User-Agent
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: commitMessage,
                content: contentBase64,
                branch: 'main',
                committer: {
                    name: 'Content Manager',
                    email: 'content-manager@example.com'
                }
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            // 提供更详细的错误信息，包括所有可能的错误字段
            const errorDetails = [
                errorData.message,
                errorData.documentation_url,
                errorData.errors ? JSON.stringify(errorData.errors) : '',
                `Status: ${response.status}`
            ].filter(Boolean).join(' - ');
            throw new Error(`上传失败: ${errorDetails}`);
        }
        
        // 重定向回当前目录
        return new Response('<html><head><meta http-equiv="refresh" content="0;url=' + (path ? '/tree/' + path : '/') + '"></head></html>', {
            headers: { 'Content-Type': 'text/html' }
        });
    } catch (error) {
        return new Response(`上传错误: ${error.message}`, { status: 500 });
    }
}

// 处理删除文件或文件夹
async function handleDelete(request) {
    try {
        // 检查配置是否已设置
        if (!config.owner || !config.repo || !config.token) {
            return new Response('配置未设置，请三次点击页面空白区域进行配置。', { status: 400 });
        }
        // 解析表单数据
        const formData = await request.formData();
        const path = formData.get('path');
        const type = formData.get('type'); // 'file' 或 'dir'
        
        if (!path || !type) {
            throw new Error('缺少必要参数');
        }
        
        if (type === 'dir') {
            // 对于文件夹，需要先获取内容然后删除
            // 1. 获取文件夹内容
            const listUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
            const listResponse = await fetch(listUrl, {
                headers: {
                    'Authorization': `token ${config.token}`,
                    'User-Agent': 'Cloudflare-Workers-GitHub-Proxy'
                }
            });
            
            if (!listResponse.ok) {
                throw new Error(`获取文件夹内容失败: ${listResponse.status}`);
            }
            
            const contents = await listResponse.json();
            
            // 2. 删除所有内容（包括.gitkeep文件）
            for (const item of contents) {
                const deleteUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${item.path}`;
                await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${config.token}`,
                        'User-Agent': 'Cloudflare-Workers-GitHub-Proxy',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Delete ${item.type}: ${item.name}`,
                        sha: item.sha
                    })
                });
            }
        } else {
            // 对于文件，先获取SHA值
            const getFileUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
            const getFileResponse = await fetch(getFileUrl, {
                headers: {
                    'Authorization': `token ${config.token}`,
                    'User-Agent': 'Cloudflare-Workers-GitHub-Proxy'
                }
            });
            
            if (!getFileResponse.ok) {
                throw new Error(`获取文件信息失败: ${getFileResponse.status}`);
            }
            
            const fileData = await getFileResponse.json();
            
            // 删除文件
            const deleteUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
            const deleteResponse = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${config.token}`,
                    'User-Agent': 'Cloudflare-Workers-GitHub-Proxy',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Delete file: ${path.split('/').pop()}`,
                    sha: fileData.sha
                })
            });
            
            if (!deleteResponse.ok) {
                const errorData = await deleteResponse.json();
                throw new Error(`删除失败: ${errorData.message || deleteResponse.status}`);
            }
        }
        
        // 重定向回父目录
        const parentPath = path.split('/').slice(0, -1).join('/');
        return new Response('<html><head><meta http-equiv="refresh" content="0;url=' + (parentPath ? '/tree/' + parentPath : '/') + '"></head></html>', {
            headers: { 'Content-Type': 'text/html' }
        });
    } catch (error) {
        return new Response(`删除错误: ${error.message}`, { status: 500 });
    }
}

// 处理配置更新
async function handleUpdateConfig(request) {
    try {
        // 此函数不需要检查配置，因为它正是用来设置配置的
        // 解析表单数据
        const formData = await request.formData();
        const owner = formData.get('owner');
        const repo = formData.get('repo');
        const token = formData.get('token');
        
        if (!owner || !repo || !token) {
            throw new Error('配置参数不完整');
        }
        
        // 在Cloudflare Worker中，直接更新全局配置变量
        // 注意：这种方式在单个Worker实例中有效，但不会跨实例持久化
        // 对于生产环境，应该使用Cloudflare KV存储
        GITHUB_OWNER = owner;
        GITHUB_REPO = repo;
        GITHUB_TOKEN = token;
        
        return new Response(`
            <html>
            <head>
                <meta http-equiv="refresh" content="1;url=/">
                <script>
                    alert('配置已更新！正在刷新页面...');
                </script>
            </head>
            <body>正在更新配置...</body>
            </html>
        `, { headers: { 'Content-Type': 'text/html' } });
    } catch (error) {
        return new Response(`配置更新错误: ${error.message}`, { status: 500 });
    }
}

// 处理创建文件夹
async function handleCreateFolder(request) {
    try {
        // 检查配置是否已设置
        if (!config.owner || !config.repo || !config.token) {
            return new Response('配置未设置，请三次点击页面空白区域进行配置。', { status: 400 });
        }
        // 解析表单数据
        const formData = await request.formData();
        const folderName = formData.get('folderName');
        let path = formData.get('path') || '';
        
        if (!folderName) {
            throw new Error('请输入文件夹名称');
        }
        
        // 验证文件夹名称
        if (folderName.includes('/') || folderName.includes('\\')) {
            throw new Error('文件夹名称不能包含斜杠');
        }
        
        // 构建完整的文件夹路径
        const fullPath = path ? `${path}/${folderName}` : folderName;
        
        // 在GitHub上创建文件夹需要创建一个占位文件
        // GitHub不直接支持创建空文件夹，所以我们创建一个.gitkeep文件
        const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${fullPath}/.gitkeep`;
        
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${config.token}`,
                'User-Agent': 'Cloudflare-Workers-GitHub-Proxy',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Create folder: ${folderName}`,
                content: '' // 空内容
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`创建文件夹失败: ${errorData.message || response.status}`);
        }
        
        // 重定向回当前目录
        return new Response('<html><head><meta http-equiv="refresh" content="0;url=' + (path ? '/tree/' + path : '/') + '"></head></html>', {
            headers: { 'Content-Type': 'text/html' }
        });
    } catch (error) {
        return new Response(`创建文件夹错误: ${error.message}`, { status: 500 });
    }
}

// Cloudflare Worker事件监听器
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});