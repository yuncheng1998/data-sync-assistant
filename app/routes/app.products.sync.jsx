import { useState, useCallback } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  Box,
  Banner,
  BlockStack,
  InlineStack,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getProductCount } from "../services/database/productService";

// 加载器 - 获取初始数据
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  // 获取数据库中的产品数量
  const productCount = await getProductCount(session.shop);

  return json({
    shop: session.shop,
    productCount,
  });
};

export default function ProductSync() {
  const { shop, productCount } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const isLoading = navigation.state === "submitting";

  // 触发同步
  const handleSync = useCallback((syncType = "current") => {
    const formData = new FormData();
    formData.append("syncType", syncType);
    setSyncResult(null);
    setSyncError(null);

    submit(formData, {
      method: "post",
      action: "/api/products/sync",
      encType: "multipart/form-data",
      fetcherKey: "sync",
      onSuccess: (data) => {
        const result = JSON.parse(data);
        setSyncResult(result.result);
        setSyncError(null);
      },
      onError: (error) => {
        setSyncResult(null);
        setSyncError(error);
      },
    });
  }, [submit]);

  return (
    <Page
      title="产品同步管理"
      subtitle="从 Shopify 同步产品数据到数据库"
      backAction={{ content: "返回", url: "/app" }}
    >
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  同步状态
                </Text>
                <BlockStack gap="200">
                  <Text as="p">
                    当前店铺: <strong>{shop}</strong>
                  </Text>
                  <Text as="p">
                    数据库产品数量: <strong>{productCount}</strong>
                  </Text>
                  <Text as="p">
                    自动同步: <strong>每5分钟</strong>
                  </Text>
                </BlockStack>
                <InlineStack wrap={false} gap="300">
                  <Button
                    primary
                    loading={isLoading}
                    onClick={() => handleSync("current")}
                  >
                    同步当前店铺产品
                  </Button>
                  <Button
                    loading={isLoading}
                    onClick={() => handleSync("all")}
                  >
                    同步所有店铺产品
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {syncResult && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    同步结果
                  </Text>
                  <Banner
                    title={syncResult.success ? "同步成功" : "同步失败"}
                    status={syncResult.success ? "success" : "critical"}
                  >
                    {syncResult.message}
                  </Banner>

                  {syncResult.success && (
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingSm">
                        详细信息
                      </Text>
                      <Box paddingBlock="200">
                        {syncResult.shops && (
                          <Text as="p">同步店铺数: {syncResult.shops}</Text>
                        )}
                        {syncResult.count && (
                          <Text as="p">同步产品数: {syncResult.count}</Text>
                        )}
                        {syncResult.products && (
                          <Text as="p">同步产品数: {syncResult.products}</Text>
                        )}
                        {syncResult.details && syncResult.details.createdCount !== undefined && (
                          <>
                            <Text as="p">
                              新增产品: {syncResult.details.createdCount}
                            </Text>
                            <Text as="p">
                              更新产品: {syncResult.details.updatedCount}
                            </Text>
                          </>
                        )}
                      </Box>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          )}

          {syncError && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    同步错误
                  </Text>
                  <Banner title="同步过程中发生错误" status="critical">
                    {syncError.message || "未知错误"}
                  </Banner>
                  {syncError.stack && (
                    <Box paddingBlock="200" as="pre">
                      {syncError.stack}
                    </Box>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          )}
        </Layout>
      </BlockStack>
    </Page>
  );
} 