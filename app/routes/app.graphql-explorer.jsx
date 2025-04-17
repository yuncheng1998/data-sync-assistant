import { useState, useCallback } from "react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// 加载器 - 获取当前店铺信息
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  return json({
    shop: session.shop,
    accessToken: session.accessToken
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
  const { shop, accessToken } = useLoaderData();
  const [query, setQuery] = useState(EXAMPLE_QUERY);
  const [variables, setVariables] = useState(EXAMPLE_VARIABLES);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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
      
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Shopify-Shop-Domain': shop
        },
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
  }, [query, variables, shop, accessToken]);

  return (
    <Page
      title="GraphQL 产品 API 浏览器"
      subtitle="测试和探索产品 GraphQL API"
      backAction={{ content: "返回", url: "/app" }}
    >
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
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
                
                <InlineStack gap="200">
                  <Button primary onClick={executeQuery} loading={loading}>
                    执行查询
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
          
          <Layout.Section>
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
              <Text as="p">认证: <code>Bearer Token</code> (使用 Shopify 访问令牌)</Text>
              <Text as="p">当前店铺: <strong>{shop}</strong></Text>
            </BlockStack>
            <Text as="p" variant="bodySm">
              在生产环境中调用此 API 时，需要在请求头中包含:
              <ul>
                <li><code>Authorization: Bearer {'<shopify-access-token>'}</code></li>
                <li><code>X-Shopify-Shop-Domain: {'<shop-domain>'}</code></li>
              </ul>
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
} 