#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, redirect, url_for, flash, send_file, session
import boto3
from botocore.exceptions import ClientError
import os
from werkzeug.utils import secure_filename
import io
from datetime import datetime
import json

app = Flask(__name__)
app.secret_key = 'rainyun-s3-manager-secret-key-2023'
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  # 限制上传文件大小为1024MB

# 默认配置信息
DEFAULT_CONFIG = {
    'endpoint_url': 'https://cn-nb1.rains3.com',
    'access_key': '',
    'secret_key': ''
}

def get_s3_client():
    """初始化S3客户端"""
    config = session.get('s3_config', DEFAULT_CONFIG)
    return boto3.client('s3',
                        endpoint_url=config['endpoint_url'],
                        aws_access_key_id=config['access_key'],
                        aws_secret_access_key=config['secret_key'])

# HTML模板
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>雨云对象存储管理</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.0/font/bootstrap-icons.css">
    <style>
        :root {
            --primary-color: #3498db;
            --secondary-color: #2ecc71;
            --accent-color: #e74c3c;
            --light-bg: #f8f9fa;
            --dark-bg: #343a40;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--light-bg);
            color: #333;
            line-height: 1.6;
        }
        
        .navbar {
            background: linear-gradient(135deg, var(--primary-color), #2980b9);
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .card {
            border: none;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            margin-bottom: 20px;
            overflow: hidden;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        
        .card-header {
            background: linear-gradient(135deg, var(--primary-color), #2980b9);
            color: white;
            font-weight: 600;
            border-bottom: none;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, var(--primary-color), #2980b9);
            border: none;
            border-radius: 5px;
            transition: all 0.3s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, #2980b9, var(--primary-color));
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .btn-success {
            background: linear-gradient(135deg, var(--secondary-color), #27ae60);
            border: none;
            border-radius: 5px;
            transition: all 0.3s ease;
        }
        
        .btn-success:hover {
            background: linear-gradient(135deg, #27ae60, var(--secondary-color));
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .btn-danger {
            background: linear-gradient(135deg, var(--accent-color), #c0392b);
            border: none;
            border-radius: 5px;
            transition: all 0.3s ease;
        }
        
        .btn-danger:hover {
            background: linear-gradient(135deg, #c0392b, var(--accent-color));
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .table-hover tbody tr:hover {
            background-color: rgba(52, 152, 219, 0.1);
        }
        
        .form-control:focus {
            border-color: var(--primary-color);
            box-shadow: 0 0 0 0.2rem rgba(52, 152, 219, 0.25);
        }
        
        .alert {
            border-radius: 8px;
            border: none;
        }
        
        .config-panel {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        
        .file-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 15px;
            border-bottom: 1px solid #eee;
            transition: background-color 0.2s ease;
        }
        
        .file-item:hover {
            background-color: #f8f9fa;
        }
        
        .file-icon {
            font-size: 1.5rem;
            margin-right: 10px;
            color: var(--primary-color);
        }
        
        .folder-icon {
            color: #f39c12;
        }
        
        .file-actions {
            display: flex;
            gap: 10px;
        }
        
        .progress-bar {
            background: linear-gradient(135deg, var(--primary-color), #2980b9);
        }
        
        .upload-status {
            display: none;
            margin-top: 10px;
        }
        
        .breadcrumb {
            background-color: transparent;
            padding: 0;
            margin-bottom: 15px;
        }
        
        .current-folder {
            font-weight: 600;
            color: var(--primary-color);
            margin-bottom: 15px;
            padding: 10px;
            background-color: white;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
    </style>
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark">
        <div class="container">
            <a class="navbar-brand" href="/">
                <i class="bi bi-cloud-fill"></i> 雨云对象存储管理
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="#" data-bs-toggle="modal" data-bs-target="#configModal">
                            <i class="bi bi-gear-fill"></i> 配置
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/">
                            <i class="bi bi-house-fill"></i> 首页
                        </a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <div class="container mt-4">
        <!-- 消息提示 -->
        {% if messages %}
            {% for message in messages %}
                <div class="alert alert-info alert-dismissible fade show">
                    {{ message }}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            {% endfor %}
        {% endif %}

        <!-- 配置面板 -->
        <div class="config-panel">
            <h4><i class="bi bi-info-circle"></i> 连接信息</h4>
            <div class="row mt-3">
                <div class="col-md-4">
                    <p><strong>API 端点:</strong> {{ config.endpoint_url }}</p>
                </div>
                <div class="col-md-4">
                    <p><strong>Access Key:</strong> {{ config.access_key[:4] }}...{{ config.access_key[-4:] if config.access_key else '' }}</p>
                </div>
                <div class="col-md-4">
                    <button class="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#configModal">
                        <i class="bi bi-pencil"></i> 修改配置
                    </button>
                </div>
            </div>
        </div>

        <!-- 内容区域 -->
        {{ content|safe }}
    </div>

    <!-- 配置模态框 -->
    <div class="modal fade" id="configModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">配置连接信息</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <form method="post" action="/configure">
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">API 端点</label>
                            <input type="text" class="form-control" name="endpoint_url" value="{{ config.endpoint_url }}" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Access Key</label>
                            <input type="text" class="form-control" name="access_key" value="{{ config.access_key }}" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Secret Key</label>
                            <input type="password" class="form-control" name="secret_key" value="{{ config.secret_key }}" required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="submit" class="btn btn-primary">保存配置</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // 显示上传进度
        document.addEventListener('DOMContentLoaded', function() {
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                fileInput.addEventListener('change', function() {
                    const file = this.files[0];
                    if (file) {
                        const statusDiv = document.getElementById('upload-status');
                        const progressBar = document.getElementById('upload-progress');
                        
                        statusDiv.style.display = 'block';
                        progressBar.style.width = '0%';
                        progressBar.textContent = '0%';
                        
                        // 模拟上传进度（实际应用中应使用XMLHttpRequest或Fetch API）
                        let progress = 0;
                        const interval = setInterval(() => {
                            progress += 5;
                            progressBar.style.width = progress + '%';
                            progressBar.textContent = progress + '%';
                            
                            if (progress >= 100) {
                                clearInterval(interval);
                                progressBar.textContent = '上传完成';
                            }
                        }, 100);
                    }
                });
            }
        });
        
        // 复制文本到剪贴板
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(function() {
                alert('已复制到剪贴板: ' + text);
            }).catch(function(err) {
                alert('复制失败: ' + err);
            });
        }
        
        // 创建文件夹
        function createFolder() {
            const folderName = prompt('请输入文件夹名称:');
            if (folderName) {
                // 确保文件夹名称以斜杠结尾
                const folderPath = folderName.endsWith('/') ? folderName : folderName + '/';
                window.location.href = '/create-folder/{{ bucket_name }}?prefix={{ current_prefix }}&folder_name=' + encodeURIComponent(folderPath);
            }
        }
    </script>
</body>
</html>
'''

def render_template(content, messages=None, config=None, bucket_name=None, current_prefix=''):
    """渲染模板的辅助函数"""
    if messages is None:
        messages = []
    if config is None:
        config = session.get('s3_config', DEFAULT_CONFIG)
    
    # 将消息列表转换为HTML
    messages_html = ""
    for message in messages:
        messages_html += f'<div class="alert alert-info alert-dismissible fade show">{message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>'
    
    # 替换模板中的占位符
    html = HTML_TEMPLATE.replace('{% if messages %}', '<!-- messages start -->')
    html = html.replace('{% endfor %}', '<!-- messages end -->')
    html = html.replace('<!-- messages start --><!-- messages end -->', messages_html)
    html = html.replace('{{ content|safe }}', content)
    html = html.replace('{{ config.endpoint_url }}', config.get('endpoint_url', ''))
    html = html.replace('{{ config.access_key }}', config.get('access_key', ''))
    html = html.replace('{{ config.secret_key }}', config.get('secret_key', ''))
    
    if bucket_name:
        html = html.replace('{{ bucket_name }}', bucket_name)
    else:
        html = html.replace('{{ bucket_name }}', '')
        
    html = html.replace('{{ current_prefix }}', current_prefix)
    
    return html

# 路由定义
@app.route('/')
def index():
    messages = []
    config = session.get('s3_config', DEFAULT_CONFIG)
    
    # 检查是否已配置
    if not config.get('access_key') or not config.get('secret_key'):
        messages.append("请先配置API连接信息")
        config_html = '''
        <div class="card">
            <div class="card-header">欢迎使用雨云对象存储管理</div>
            <div class="card-body">
                <h5 class="card-title">尚未配置API连接信息</h5>
                <p class="card-text">请点击右上角的"配置"按钮，填写您的API端点、Access Key和Secret Key。</p>
                <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#configModal">
                    <i class="bi bi-gear-fill"></i> 配置连接信息
                </button>
            </div>
        </div>
        '''
        return render_template(config_html, messages=messages, config=config)
    
    try:
        s3 = get_s3_client()
        response = s3.list_buckets()
        buckets = [bucket['Name'] for bucket in response['Buckets']]
        
        # 生成存储桶列表HTML
        buckets_html = '''
        <div class="card">
            <div class="card-header">
                <h4><i class="bi bi-collection"></i> 存储桶列表</h4>
            </div>
            <div class="card-body">
        '''
        
        if buckets:
            buckets_html += '<div class="row">'
            for bucket in buckets:
                buckets_html += f'''
                <div class="col-md-4 mb-3">
                    <div class="card h-100">
                        <div class="card-body text-center">
                            <i class="bi bi-bucket-fill" style="font-size: 2rem; color: #3498db;"></i>
                            <h5 class="card-title mt-2">{bucket}</h5>
                            <a href="/bucket/{bucket}" class="btn btn-primary mt-2">
                                <i class="bi bi-folder2-open"></i> 浏览内容
                            </a>
                        </div>
                    </div>
                </div>
                '''
            buckets_html += '</div>'
        else:
            buckets_html += '''
            <div class="text-center py-4">
                <i class="bi bi-inbox" style="font-size: 3rem; color: #6c757d;"></i>
                <p class="mt-3 text-muted">没有找到存储桶</p>
            </div>
            '''
            
        buckets_html += '</div></div>'
        
        return render_template(buckets_html, messages=messages, config=config)
    except ClientError as e:
        error_msg = f"连接错误: {str(e)}"
        messages.append(error_msg)
        error_html = f'''
        <div class="card">
            <div class="card-header">连接错误</div>
            <div class="card-body">
                <div class="alert alert-danger">
                    <h5><i class="bi bi-exclamation-triangle"></i> 无法连接到对象存储服务</h5>
                    <p>错误信息: {error_msg}</p>
                    <p>请检查您的API配置是否正确，或者点击右上角的"配置"按钮修改连接信息。</p>
                </div>
            </div>
        </div>
        '''
        return render_template(error_html, messages=messages, config=config)

@app.route('/configure', methods=['POST'])
def configure():
    """保存API配置"""
    endpoint_url = request.form.get('endpoint_url', '').strip()
    access_key = request.form.get('access_key', '').strip()
    secret_key = request.form.get('secret_key', '').strip()
    
    if not endpoint_url or not access_key or not secret_key:
        flash("所有字段都必须填写")
        return redirect('/')
    
    # 保存配置到session
    session['s3_config'] = {
        'endpoint_url': endpoint_url,
        'access_key': access_key,
        'secret_key': secret_key
    }
    
    flash("API配置已保存")
    return redirect('/')

@app.route('/bucket/<bucket_name>')
def bucket_contents(bucket_name):
    messages = []
    config = session.get('s3_config', DEFAULT_CONFIG)
    current_prefix = request.args.get('prefix', '')
    
    try:
        s3 = get_s3_client()
        
        # 获取文件列表
        objects = []
        folders = []
        
        try:
            # 列出对象
            paginator = s3.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=bucket_name, Prefix=current_prefix, Delimiter='/'):
                # 处理文件夹
                if 'CommonPrefixes' in page:
                    for prefix in page['CommonPrefixes']:
                        folders.append({
                            'name': prefix['Prefix'].replace(current_prefix, '').rstrip('/'),
                            'prefix': prefix['Prefix'],
                            'type': 'folder'
                        })
                
                # 处理文件
                if 'Contents' in page:
                    for obj in page['Contents']:
                        # 跳过文件夹标记对象
                        if obj['Key'] == current_prefix:
                            continue
                            
                        objects.append({
                            'key': obj['Key'],
                            'name': obj['Key'].replace(current_prefix, ''),
                            'size': obj['Size'],
                            'last_modified': obj['LastModified'],
                            'type': 'file'
                        })
        except ClientError as e:
            messages.append(f"无法列出文件: {str(e)}")
        
        # 生成面包屑导航
        breadcrumb_html = '<nav aria-label="breadcrumb"><ol class="breadcrumb">'
        breadcrumb_html += f'<li class="breadcrumb-item"><a href="/bucket/{bucket_name}">根目录</a></li>'
        
        if current_prefix:
            parts = current_prefix.rstrip('/').split('/')
            path = ''
            for i, part in enumerate(parts):
                if part:  # 跳过空部分
                    path += part + '/'
                    if i == len(parts) - 1:
                        breadcrumb_html += f'<li class="breadcrumb-item active" aria-current="page">{part}</li>'
                    else:
                        breadcrumb_html += f'<li class="breadcrumb-item"><a href="/bucket/{bucket_name}?prefix={path}">{part}</a></li>'
        
        breadcrumb_html += '</ol></nav>'
        
        # 生成文件列表HTML
        content_html = breadcrumb_html
        
        # 当前路径显示
        content_html += f'<div class="current-folder"><i class="bi bi-folder-fill"></i> 当前路径: {current_prefix or "根目录"}</div>'
        
        # 操作按钮
        content_html += '''
        <div class="d-flex gap-2 mb-3">
            <button class="btn btn-success" data-bs-toggle="modal" data-bs-target="#uploadModal">
                <i class="bi bi-upload"></i> 上传文件
            </button>
            <button class="btn btn-primary" onclick="createFolder()">
                <i class="bi bi-folder-plus"></i> 创建文件夹
            </button>
        </div>
        '''
        
        # 文件和文件夹列表
        if folders or objects:
            content_html += '<div class="card"><div class="card-body p-0">'
            
            # 显示文件夹
            for folder in folders:
                content_html += f'''
                <div class="file-item">
                    <div>
                        <i class="bi bi-folder-fill folder-icon"></i>
                        <a href="/bucket/{bucket_name}?prefix={folder['prefix']}">{folder['name']}</a>
                    </div>
                    <div class="file-actions">
                        <a href="/delete/{bucket_name}/{folder['prefix']}" class="btn btn-outline-danger btn-sm" 
                           onclick="return confirm('确定要删除文件夹 {folder['name']} 吗？注意：这将删除文件夹中的所有内容！')">
                            <i class="bi bi-trash"></i>
                        </a>
                    </div>
                </div>
                '''
            
            # 显示文件
            for obj in objects:
                # 格式化文件大小
                size = obj["size"]
                if size > 1024*1024:
                    size_str = f"{size/(1024*1024):.2f} MB"
                elif size > 1024:
                    size_str = f"{size/1024:.2f} KB"
                else:
                    size_str = f"{size} B"
                
                content_html += f'''
                <div class="file-item">
                    <div>
                        <i class="bi bi-file-earmark file-icon"></i>
                        {obj['name']}
                        <small class="text-muted d-block mt-1">{size_str} - {obj['last_modified'].strftime("%Y-%m-%d %H:%M:%S")}</small>
                    </div>
                    <div class="file-actions">
                        <a href="/download/{bucket_name}/{obj['key']}" class="btn btn-outline-primary btn-sm">
                            <i class="bi bi-download"></i>
                        </a>
                        <a href="/delete/{bucket_name}/{obj['key']}" class="btn btn-outline-danger btn-sm" 
                           onclick="return confirm('确定要删除文件 {obj["name"]} 吗？')">
                            <i class="bi bi-trash"></i>
                        </a>
                    </div>
                </div>
                '''
            
            content_html += '</div></div>'
        else:
            content_html += '''
            <div class="card">
                <div class="card-body text-center py-5">
                    <i class="bi bi-inbox" style="font-size: 3rem; color: #6c757d;"></i>
                    <p class="mt-3 text-muted">此目录为空</p>
                </div>
            </div>
            '''
        
        # 上传模态框
        content_html += '''
        <div class="modal fade" id="uploadModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">上传文件</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form method="post" action="/upload/''' + bucket_name + '''" enctype="multipart/form-data">
                        <input type="hidden" name="prefix" value="''' + current_prefix + '''">
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">选择文件</label>
                                <input type="file" class="form-control" name="file" required>
                            </div>
                            <div id="upload-status" class="upload-status">
                                <div class="progress">
                                    <div id="upload-progress" class="progress-bar" role="progressbar" style="width: 0%;">0%</div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="submit" class="btn btn-primary">上传</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        '''
        
        return render_template(content_html, messages=messages, config=config, 
                              bucket_name=bucket_name, current_prefix=current_prefix)
    except ClientError as e:
        messages.append(f"访问存储桶错误: {str(e)}")
        return redirect('/')

@app.route('/upload/<bucket_name>', methods=['POST'])
def upload_file(bucket_name):
    messages = []
    if 'file' not in request.files:
        flash('没有选择文件')
        return redirect(f'/bucket/{bucket_name}')
    
    file = request.files['file']
    if file.filename == '':
        flash('没有选择文件')
        return redirect(f'/bucket/{bucket_name}')
    
    prefix = request.form.get('prefix', '')
    
    if file:
        filename = secure_filename(file.filename)
        # 添加前缀到文件名
        key = prefix + filename if prefix else filename
        
        try:
            s3 = get_s3_client()
            s3.upload_fileobj(file, bucket_name, key)
            flash(f'文件 {filename} 上传成功')
        except ClientError as e:
            flash(f'上传失败: {str(e)}')
    
    return redirect(f'/bucket/{bucket_name}?prefix={prefix}')

@app.route('/create-folder/<bucket_name>')
def create_folder(bucket_name):
    folder_name = request.args.get('folder_name', '')
    prefix = request.args.get('prefix', '')
    
    if not folder_name:
        flash('文件夹名称不能为空')
        return redirect(f'/bucket/{bucket_name}?prefix={prefix}')
    
    # 确保文件夹名称以斜杠结尾
    if not folder_name.endswith('/'):
        folder_name += '/'
    
    # 添加前缀到文件夹路径
    folder_path = prefix + folder_name if prefix else folder_name
    
    try:
        s3 = get_s3_client()
        # 创建文件夹（在S3中，文件夹是通过创建空对象实现的）
        s3.put_object(Bucket=bucket_name, Key=folder_path)
        flash(f'文件夹 {folder_name} 创建成功')
    except ClientError as e:
        flash(f'创建文件夹失败: {str(e)}')
    
    return redirect(f'/bucket/{bucket_name}?prefix={prefix}')

@app.route('/download/<bucket_name>/<path:key>')
def download_file(bucket_name, key):
    try:
        s3 = get_s3_client()
        file_obj = io.BytesIO()
        s3.download_fileobj(bucket_name, key, file_obj)
        file_obj.seek(0)
        
        # 获取文件名
        filename = key.split('/')[-1] if '/' in key else key
        
        return send_file(
            file_obj,
            as_attachment=True,
            download_name=filename
        )
    except ClientError as e:
        flash(f'下载失败: {str(e)}')
        return redirect(f'/bucket/{bucket_name}')

@app.route('/delete/<bucket_name>/<path:key>')
def delete_file(bucket_name, key):
    try:
        s3 = get_s3_client()
        
        # 检查是否是文件夹
        if key.endswith('/'):
            # 删除文件夹及其内容
            paginator = s3.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=bucket_name, Prefix=key):
                if 'Contents' in page:
                    for obj in page['Contents']:
                        s3.delete_object(Bucket=bucket_name, Key=obj['Key'])
            flash(f'文件夹 {key} 及其内容已删除')
        else:
            # 删除文件
            s3.delete_object(Bucket=bucket_name, Key=key)
            flash(f'文件 {key} 删除成功')
    except ClientError as e:
        flash(f'删除失败: {str(e)}')
    
    # 获取当前前缀
    prefix = '/'.join(key.split('/')[:-1]) + '/' if '/' in key else ''
    return redirect(f'/bucket/{bucket_name}?prefix={prefix}')

if __name__ == '__main__':
    print("雨云对象存储管理服务启动中...")
    print(f"访问地址: http://127.0.0.1:5000")
    print(f"或使用局域网IP访问: http://<您的设备IP>:5000")
    app.run(debug=False, host='0.0.0.0', port=5000)