#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
GraphQL API 客户端
用于获取 JWT 令牌并执行 GraphQL 查询
"""

import requests
import json
import argparse
import sys
from urllib.parse import urljoin

class GraphQLClient:
    def __init__(self, base_url, verbose=False):
        """初始化 GraphQL 客户端

        Args:
            base_url (str): API 基础 URL，例如 http://localhost:3000
            verbose (bool): 是否显示详细日志
        """
        self.base_url = base_url
        self.token = None
        self.verbose = verbose
        self.session = requests.Session()
    
    def login(self, email, password, endpoint="/auth/token"):
        """获取 JWT 令牌

        Args:
            email (str): 用户邮箱
            password (str): 密码
            endpoint (str): 登录接口路径

        Returns:
            bool: 登录是否成功
        """
        login_url = urljoin(self.base_url, endpoint)
        
        # 准备登录数据
        login_data = {
            "email": email,
            "password": password
        }
        
        if self.verbose:
            print(f"🔑 正在尝试登录: {login_url}")
            print(f"邮箱: {email}")
        
        try:
            # 发送登录请求
            headers = {'Content-Type': 'application/json'}
            response = self.session.post(login_url, json=login_data, headers=headers)
            
            # 解析响应
            if response.status_code == 200:
                result = response.json()
                if result.get('success', False) and result.get('token'):
                    self.token = result['token']
                    if self.verbose:
                        print(f"✅ 登录成功，已获取令牌")
                        print(f"令牌类型: {result.get('tokenType', 'Bearer')}")
                        if result.get('user'):
                            print(f"用户信息: {result['user']['email']} (角色: {result['user']['role']})")
                        print(f"过期时间: {result.get('expiresIn', '未知')}")
                    return True
                else:
                    print(f"❌ 登录失败: {result.get('error', '未知错误')}")
                    return False
            else:
                print(f"❌ 登录失败: HTTP状态码 {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"错误信息: {error_data.get('error', '未知错误')}")
                except:
                    print(f"错误响应: {response.text[:200]}")
                return False
                
        except Exception as e:
            print(f"❌ 登录请求异常: {str(e)}")
            return False
    
    def execute_query(self, query, variables=None, endpoint="/graphql"):
        """执行 GraphQL 查询

        Args:
            query (str): GraphQL 查询字符串
            variables (dict, optional): 查询变量
            endpoint (str): GraphQL 接口路径

        Returns:
            dict: 查询结果
        """
        if not self.token:
            print("❌ 尚未登录或获取令牌，请先调用 login() 方法")
            return None
        
        graphql_url = urljoin(self.base_url, endpoint)
        
        # 准备请求头
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.token}'
        }
        
        # 准备查询数据
        payload = {
            "query": query
        }
        
        if variables:
            payload["variables"] = variables
        
        if self.verbose:
            print(f"🔍 正在执行查询: {graphql_url}")
            print(f"请求头: Authorization: Bearer {self.token[:10]}...")
            print(f"查询: {query[:100]}...")
            if variables:
                print(f"变量: {json.dumps(variables, ensure_ascii=False)}")
        
        try:
            response = self.session.post(graphql_url, headers=headers, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('errors'):
                    print(f"⚠️ 查询返回错误:")
                    for error in result['errors']:
                        print(f"  - {error.get('message')}")
                return result
            elif response.status_code == 401:
                print(f"❌ 认证失败: 令牌无效或已过期")
                try:
                    error_data = response.json()
                    if error_data.get('errors'):
                        for error in error_data['errors']:
                            print(f"  - {error.get('message')}")
                except:
                    print(f"响应内容: {response.text[:200]}")
                return None
            else:
                print(f"❌ 查询失败: HTTP {response.status_code}")
                try:
                    error_data = response.json()
                    if error_data.get('errors'):
                        for error in error_data['errors']:
                            print(f"  - {error.get('message')}")
                except:
                    print(f"响应内容: {response.text[:200]}")
                return None
                
        except Exception as e:
            print(f"❌ 查询请求异常: {str(e)}")
            return None
    
    def print_result(self, result, format_output=True):
        """格式化打印查询结果

        Args:
            result (dict): 查询结果
            format_output (bool): 是否格式化输出
        """
        if not result:
            return
        
        if format_output:
            print("\n📊 查询结果:")
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(result)
        
        # 如果有数据，提取一些关键信息
        if result.get('data'):
            # 检查是否为用户信息查询
            if result['data'].get('me'):
                user = result['data']['me']
                print(f"\n👤 当前用户: {user.get('email')}")
                print(f"用户ID: {user.get('userId')}")
                print(f"角色: {user.get('role')}")
                
            # 检查是否有产品数据
            if result['data'].get('products'):
                products = result['data']['products']
                print(f"\n📦 共找到 {products.get('totalCount', 0)} 个产品")
                
                if products.get('items'):
                    print("\n产品列表:")
                    for i, product in enumerate(products['items'], 1):
                        title = product.get('title', '未命名产品')
                        vendor = product.get('vendor', '未知供应商')
                        price = f"{product.get('minPrice', 0)} - {product.get('maxPrice', 0)}"
                        print(f"{i}. {title} ({vendor}) - 价格: {price}")


def main():
    parser = argparse.ArgumentParser(description="GraphQL API 客户端")
    parser.add_argument("-u", "--url", required=True, help="API 基础 URL，例如 http://localhost:3000")
    parser.add_argument("--email", default="user@example.com", help="用户邮箱")
    parser.add_argument("--password", default="123456", help="密码")
    parser.add_argument("--auth-endpoint", default="/auth/token", help="认证接口路径")
    parser.add_argument("--graphql-endpoint", default="/graphql", help="GraphQL 接口路径")
    parser.add_argument("--query", help="GraphQL 查询字符串")
    parser.add_argument("--query-file", help="包含 GraphQL 查询的文件")
    parser.add_argument("--variables", help="GraphQL 查询变量 (JSON 格式)")
    parser.add_argument("--verbose", action="store_true", help="显示详细日志")
    
    args = parser.parse_args()
    
    # 获取查询字符串
    query = args.query
    if args.query_file:
        try:
            with open(args.query_file, 'r', encoding='utf-8') as f:
                query = f.read()
        except Exception as e:
            print(f"❌ 无法读取查询文件: {str(e)}")
            sys.exit(1)
    
    if not query:
        # 使用默认查询 - 修改为匹配实际schema的查询
        query = """
        {
          me {
            userId
            email
            role
          }
        }
        """
    
    # 解析变量
    variables = None
    if args.variables:
        try:
            variables = json.loads(args.variables)
        except Exception as e:
            print(f"❌ 无法解析查询变量: {str(e)}")
            sys.exit(1)
    
    # 创建客户端并执行查询
    client = GraphQLClient(args.url, verbose=args.verbose)
    
    # 登录获取令牌
    if not client.login(args.email, args.password, args.auth_endpoint):
        sys.exit(1)
    
    # 执行查询
    result = client.execute_query(query, variables, args.graphql_endpoint)
    
    # 打印结果
    if result:
        client.print_result(result)


if __name__ == "__main__":
    main() 