import { useState } from "react";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import {
  AppProvider as PolarisAppProvider,
  Button,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
  Banner,
} from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

/**
 * 增强版的loader函数，带有详细日志记录
 */
export const loader = async ({ request }) => {
  // 提取URL参数
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');

  console.log(`[Auth.Login] 加载Auth登录页面, URL: ${request.url}`);
  console.log(`[Auth.Login] Shop参数: ${shop || '未提供'}`);

  try {
    console.log(`[Auth.Login] 开始执行login流程...`);
    const loginResult = await login(request);
    console.log(`[Auth.Login] login流程执行完成，结果类型: ${typeof loginResult}`);

    // 检查是否是重定向响应
    if (loginResult instanceof Response) {
      if (loginResult.status >= 300 && loginResult.status < 400) {
        const redirectLocation = loginResult.headers.get('Location');
        console.log(`[Auth.Login] 检测到重定向，目标URL: ${redirectLocation}`);
        // 直接返回重定向响应，不要将其视为错误
        return loginResult;
      }
    }

    const errors = loginErrorMessage(loginResult);
    if (errors && Object.keys(errors).length > 0) {
      console.log(`[Auth.Login] 处理中发现错误:`, JSON.stringify(errors));
    } else {
      console.log(`[Auth.Login] 处理完成，无错误`);
    }

    return { errors, polarisTranslations, shop };
  } catch (error) {
    console.error(`[Auth.Login] loader处理过程中出错:`, error);
    console.error(`[Auth.Login] 错误类型: ${error.constructor.name}`);
    console.error(`[Auth.Login] 错误消息: ${error.message}`);
    console.error(`[Auth.Login] 错误堆栈: ${error.stack}`);

    return {
      errors: {
        shop: error.message,
        detail: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      },
      polarisTranslations,
      shop
    };
  }
};

/**
 * 增强版的action函数，带有详细日志记录
 */
export const action = async ({ request }) => {
  try {
    console.log(`[Auth.Login] 开始执行表单提交, 方法: ${request.method}`);
    
    // 处理表单数据
    const formData = await request.formData();
    const shop = formData.get('shop');
    console.log(`[Auth.Login] 表单提交的商店: ${shop || '未提供'}`);
    
    // 执行登录
    console.log(`[Auth.Login] 开始执行login流程...`);
    const loginResult = await login(request);
    console.log(`[Auth.Login] login流程执行完成，结果类型: ${typeof loginResult}`);
    
    // 检查是否是重定向响应
    if (loginResult instanceof Response) {
      if (loginResult.status >= 300 && loginResult.status < 400) {
        const redirectLocation = loginResult.headers.get('Location');
        console.log(`[Auth.Login] 检测到重定向，目标URL: ${redirectLocation}`);
        // 直接返回重定向响应，不要将其视为错误
        return loginResult;
      }
    }
    
    const errors = loginErrorMessage(loginResult);
    if (errors && Object.keys(errors).length > 0) {
      console.log(`[Auth.Login] 处理中发现错误:`, JSON.stringify(errors));
    } else {
      console.log(`[Auth.Login] 处理完成，无错误`);
    }
    
    return { errors };
  } catch (error) {
    console.error(`[Auth.Login] action处理过程中出错:`, error);
    console.error(`[Auth.Login] 错误类型: ${error.constructor.name}`);
    console.error(`[Auth.Login] 错误消息: ${error.message}`);
    console.error(`[Auth.Login] 错误堆栈: ${error.stack}`);
    
    return {
      errors: {
        shop: error.message,
        detail: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      }
    };
  }
};

export default function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState(loaderData.shop || "");
  const { errors } = actionData || loaderData;
  
  // 检查是否有详细错误信息
  const hasDetailedError = errors && errors.detail;

  return (
    <PolarisAppProvider i18n={loaderData.polarisTranslations}>
      <Page>
        <Card>
          {errors && errors.shop && (
            <Banner status="critical" title="认证错误">
              <p>{errors.shop}</p>
            </Banner>
          )}
          
          <Form method="post">
            <FormLayout>
              <Text variant="headingMd" as="h2">
                登录到数据同步助手
              </Text>
              <TextField
                type="text"
                name="shop"
                label="商店域名"
                helpText="example.myshopify.com"
                value={shop}
                onChange={setShop}
                autoComplete="on"
                error={errors.shop}
              />
              <Button submit>登录</Button>
            </FormLayout>
          </Form>
          
          {hasDetailedError && process.env.NODE_ENV !== 'production' && (
            <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#f4f6f8', borderRadius: '4px'}}>
              <Text variant="bodyMd" as="p" fontWeight="bold">详细错误信息（调试模式）:</Text>
              <pre style={{whiteSpace: 'pre-wrap', overflowX: 'auto'}}>
                {errors.detail}
              </pre>
            </div>
          )}
        </Card>
      </Page>
    </PolarisAppProvider>
  );
}
