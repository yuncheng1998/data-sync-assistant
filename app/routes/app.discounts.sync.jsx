import { useState, useCallback } from "react";
import { json } from "@remix-run/node";
import { useActionData, useNavigation, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Button,
  Text,
  Box,
  Card,
  Banner,
  Spinner,
  SkeletonBodyText,
  Modal,
  Checkbox,
  BlockStack,
  ChoiceList,
  Select,
  InlineStack
} from "@shopify/polaris";
import { DiscountIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getPriceRuleCount, executeDiscountSync } from "../services/database/discountService";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  // 获取折扣数据统计
  const discountCount = await getPriceRuleCount();
  
  return json({
    count: discountCount || 0,
  });
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  
  // 获取表单数据
  const formData = await request.formData();
  
  try {
    // 准备同步选项
    const options = {};
    
    // 处理同步选项
    if (formData.has('fullSync')) {
      options.useIncrementalSync = formData.get('fullSync') !== 'true';
    }
    
    if (formData.has('syncModifiedOnly')) {
      options.syncModifiedOnly = formData.get('syncModifiedOnly') === 'true';
    }
    
    if (formData.has('batchSize')) {
      const batchSize = parseInt(formData.get('batchSize'), 10);
      if (!isNaN(batchSize) && batchSize > 0) {
        options.batchSize = batchSize;
      }
    }
    
    // 直接调用折扣同步服务
    console.log('开始执行折扣同步，选项：', options);
    const result = await executeDiscountSync(options);
    
    return json({
      success: result.success,
      message: result.message,
      count: result.count,
      details: result.details,
    });
  } catch (error) {
    console.error("折扣同步失败:", error);
    return json({ 
      success: false, 
      message: `折扣同步失败: ${error.message}` 
    });
  }
};

export default function DiscountSync() {
  // 表单提交
  const submit = useSubmit();
  const actionData = useActionData();
  const navigation = useNavigation();
  
  // 模态框状态
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncOptions, setSyncOptions] = useState({
    fullSync: false,
    syncModifiedOnly: true,
    batchSize: "50",
  });
  
  // 判断是否正在提交
  const isLoading = 
    navigation.state === "submitting" && 
    navigation.formMethod === "POST";
  
  // 处理同步选项变更
  const handleSyncOptionChange = useCallback((field, value) => {
    setSyncOptions(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);
  
  // 处理模态框开关
  const toggleSyncModal = useCallback(() => {
    setSyncModalOpen(!syncModalOpen);
  }, [syncModalOpen]);
  
  // 执行同步
  const handleSync = useCallback(() => {
    const formData = new FormData();
    
    // 添加同步选项
    formData.append('fullSync', syncOptions.fullSync);
    formData.append('syncModifiedOnly', syncOptions.syncModifiedOnly);
    formData.append('batchSize', syncOptions.batchSize);
    
    // 提交表单
    submit(formData, { method: "POST" });
    
    // 关闭模态框
    setSyncModalOpen(false);
  }, [submit, syncOptions]);
  
  // 批量大小选项
  const batchSizeOptions = [
    { label: "小批量 (10个)", value: "10" },
    { label: "中批量 (50个)", value: "50" },
    { label: "大批量 (100个)", value: "100" },
  ];
  
  return (
    <Page
      title="折扣同步"
      primaryAction={{
        content: "同步折扣",
        icon: DiscountIcon,
        onAction: toggleSyncModal,
        disabled: isLoading,
      }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.success === false && (
            <Banner
              title="同步出错"
              status="critical"
            >
              <p>{actionData.message}</p>
            </Banner>
          )}
          
          {actionData?.success === true && (
            <Banner
              title="同步成功"
              status="success"
            >
              <p>{actionData.message}</p>
            </Banner>
          )}
          
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                折扣数据同步
              </Text>
              <Text as="p">
                此功能可以从Shopify获取价格规则和折扣码数据，并存储到应用数据库中。您可以选择全量同步或仅同步最近更新的数据。
              </Text>
              <InlineStack gap="200">
                <Button 
                  onClick={toggleSyncModal} 
                  primary 
                  disabled={isLoading}
                >
                  {isLoading ? "同步中..." : "开始同步"}
                </Button>
              </InlineStack>
              
              {isLoading && (
                <Box padding="400">
                  <BlockStack gap="400" align="center">
                    <Spinner size="large" />
                    <Text as="p" variant="bodyMd">
                      正在同步折扣数据，这可能需要一些时间...
                    </Text>
                  </BlockStack>
                </Box>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
        
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                折扣数据统计
              </Text>
              <BlockStack gap="200">
                <InlineStack gap="200" align="space-between">
                  <Text as="span" variant="bodyMd">
                    总折扣数量
                  </Text>
                  <Text as="span" variant="heading2xl">
                    {isLoading ? <SkeletonBodyText lines={1} /> : actionData?.count || 0}
                  </Text>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
      
      {/* 同步选项模态框 */}
      <Modal
        open={syncModalOpen}
        onClose={toggleSyncModal}
        title="折扣同步选项"
        primaryAction={{
          content: isLoading ? "同步中..." : "开始同步",
          onAction: handleSync,
          disabled: isLoading,
        }}
        secondaryActions={[
          {
            content: "取消",
            onAction: toggleSyncModal,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p">
              请选择折扣同步的方式和选项：
            </Text>
            
            <Checkbox
              label="全量同步（将获取所有折扣数据）"
              checked={syncOptions.fullSync}
              onChange={(checked) => handleSyncOptionChange('fullSync', checked)}
            />
            
            <Checkbox
              label="仅同步已修改数据（节省时间和API调用）"
              checked={syncOptions.syncModifiedOnly}
              onChange={(checked) => handleSyncOptionChange('syncModifiedOnly', checked)}
              disabled={syncOptions.fullSync}
            />
            
            <Select
              label="每批同步数量"
              options={batchSizeOptions}
              value={syncOptions.batchSize}
              onChange={(value) => handleSyncOptionChange('batchSize', value)}
              helpText="较大的批量可以加快同步，但可能会增加出错风险"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
} 