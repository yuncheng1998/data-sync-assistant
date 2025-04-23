import { useState, useCallback } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Box,
  LegacyCard,
  SkeletonBodyText,
  Select,
  Divider,
  Icon,
  Tooltip,
} from "@shopify/polaris";
import { DuplicateIcon } from '@shopify/polaris-icons';
import { enhancedAuthentication } from "../middleware/authMiddleware";

// 加载器 - 获取当前店铺信息
export const loader = async ({ request }) => {
  const { admin, session } = await enhancedAuthentication.admin(request);
  
  return json({
    shop: session.shop,
    accessToken: session.accessToken,
    isDevMode: process.env.NODE_ENV !== 'production'
  });
};

// 示例查询
const EXAMPLE_QUERY = `query GetProducts($limit: Int, $filter: ProductFilterInput) {
  products(
    pagination: { limit: $limit, offset: 0 }
    filter: $filter
  ) {
    items {
      id
      title
      vendor
      productType
      status
      minPrice
      maxPrice
      totalInventory
      imageUrl
      updatedAt
    }
    totalCount
    hasNextPage
  }
}`;

const EXAMPLE_VARIABLES = `{
  "limit": 5,
  "filter": {
    "minInventory": 1
  }
}`;

export default function GraphQLExplorer() {
  const { shop, accessToken, isDevMode } = useLoaderData();
  const [query, setQuery] = useState(EXAMPLE_QUERY);
  const [variables, setVariables] = useState(EXAMPLE_VARIABLES);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authType, setAuthType] = useState("bearer");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenType, setTokenType] = useState("shopify");
  const [token, setToken] = useState(accessToken || "");
  const [tokenError, setTokenError] = useState(null);
  
  const submit = useSubmit();

  // 执行 GraphQL 查询
  const executeQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      let variablesObj = {};
      if (variables) {
        try {
          variablesObj = JSON.parse(variables);
        } catch (e) {
          throw new Error(`变量解析错误: ${e.message}`);
        }
      }
      
      // 准备请求头
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // 添加认证头
      if (authType === "bearer") {
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Shopify-Shop-Domain'] = shop;
      } else if (authType === "api-key") {
        headers['X-API-Key'] = token;
      }
      
      const response = await fetch('/graphql', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          variables: variablesObj
        })
      });
      
      const data = await response.json();
      
      if (data.errors) {
        throw new Error(data.errors.map(e => e.message).join('\n'));
      }
      
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('GraphQL 查询错误:', err);
      setError(err.message || '查询失败');
    } finally {
      setLoading(false);
    }
  }, [query, variables, authType, token, shop]);
  
  // 生成新令牌
  const generateToken = useCallback(() => {
    setTokenLoading(true);
    setTokenError(null);
    
    const formData = new FormData();
    formData.append("type", tokenType);

    console.log("生成令牌:", formData);
    
    submit(formData, {
      method: "post",
      action: "/api/auth/token",
      encType: "multipart/form-data",
      replace: false,
      preventScrollReset: true,
      onSuccess: (response) => {
        try {
          const result = JSON.parse(response);
          if (result.success) {
            setToken(result.token);
            setTokenError(null);
          } else {
            setTokenError(result.error || "生成令牌失败");
          }
        } catch (error) {
          console.error("解析令牌响应失败:", error);
          setTokenError("解析令牌响应失败");
        } finally {
          console.log("令牌生成完成:", result.token);
          setTokenLoading(false);
        }
      },
      onError: (error) => {
        console.error("令牌请求错误:", error);
        setTokenError(error.message || "生成令牌失败");
        setTokenLoading(false);
      },
    });
  }, [submit, tokenType]);
  
  // 复制到剪贴板
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // 可以添加复制成功提示
    });
  };

  return (
    <Page
      title="GraphQL 产品 API 浏览器"
      subtitle="测试和探索产品 GraphQL API"
      backAction={{ content: "返回", url: "/app" }}
    >
      <BlockStack gap="500">
        <Layout>
          <Layout.Section oneHalf>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">GraphQL 查询</Text>
                <TextField
                  label="查询"
                  value={query}
                  onChange={setQuery}
                  multiline={10}
                  helpText="输入 GraphQL 查询"
                  autoComplete="off"
                  monospaced
                />
                
                <TextField
                  label="变量"
                  value={variables}
                  onChange={setVariables}
                  multiline={4}
                  helpText="输入 JSON 格式的查询变量"
                  autoComplete="off"
                  monospaced
                />
                
                <Divider />
                
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">身份验证设置</Text>
                  
                  <Select
                    label="认证类型"
                    options={[
                      {label: "Bearer 令牌", value: "bearer"},
                      {label: "API 密钥", value: "api-key"},
                      {label: "无认证", value: "none"}
                    ]}
                    value={authType}
                    onChange={setAuthType}
                  />
                  
                  {authType !== "none" && (
                    <TextField
                      label={authType === "bearer" ? "访问令牌" : "API 密钥"}
                      value={token}
                      onChange={setToken}
                      autoComplete="off"
                      type="password"
                      connectedRight={
                        <Button onClick={() => copyToClipboard(token)} icon={<Icon source={DuplicateIcon} />} />
                      }
                    />
                  )}
                  
                  {isDevMode && authType === "bearer" && (
                    <BlockStack gap="200">
                      <Select
                        label="令牌类型"
                        options={[
                          {label: "Shopify 访问令牌", value: "shopify"},
                          {label: "JWT 令牌", value: "jwt"}
                        ]}
                        value={tokenType}
                        onChange={setTokenType}
                      />
                      
                      <InlineStack gap="200">
                        <Button 
                          onClick={generateToken} 
                          loading={tokenLoading}
                          size="slim"
                        >
                          生成新令牌
                        </Button>
                        
                        <Tooltip content="仅在开发环境可用">
                          <Text variant="bodySm" as="span">(仅开发)</Text>
                        </Tooltip>
                      </InlineStack>
                      
                      {tokenError && (
                        <Banner status="critical">
                          {tokenError}
                        </Banner>
                      )}
                    </BlockStack>
                  )}
                </BlockStack>
                
                <InlineStack gap="200">
                  <Button primary onClick={executeQuery} loading={loading}>
                    执行查询
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
          
          <Layout.Section oneHalf>
            <LegacyCard title="查询结果">
              {loading && <SkeletonBodyText lines={10} />}
              
              {error && (
                <Banner title="查询错误" status="critical">
                  <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
                </Banner>
              )}
              
              {result && (
                <Box padding="400">
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    overflowX: 'auto', 
                    fontSize: '14px',
                    fontFamily: 'monospace' 
                  }}>
                    {result}
                  </pre>
                </Box>
              )}
            </LegacyCard>
          </Layout.Section>
        </Layout>
        
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">GraphQL 端点信息</Text>
            <BlockStack gap="200">
              <Text as="p">GraphQL 端点: <code>/graphql</code></Text>
              <Text as="p">认证: <code>Bearer Token</code> (使用 Shopify 访问令牌或 JWT) 或 <code>X-API-Key</code></Text>
              <Text as="p">当前店铺: <strong>{shop}</strong></Text>
            </BlockStack>
            <Text as="p" variant="bodySm">
              在生产环境中调用此 API 时，需要在请求头中包含以下认证信息之一:
              <ul>
                <li><code>Authorization: Bearer {'<token>'}</code> 和 <code>X-Shopify-Shop-Domain: {'<shop-domain>'}</code></li>
                <li><code>X-API-Key: {'<api-key>'}</code></li>
              </ul>
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
} 