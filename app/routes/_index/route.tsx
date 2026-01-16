import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useNavigate } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../../shopify.server";

import { boundary } from "@shopify/shopify-app-react-router/server";
import type { HeadersFunction } from "react-router";

const MetaobjectDefinition = `#graphql
        mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
          metaobjectDefinitionCreate(definition: $definition) {
            metaobjectDefinition {
              name
              type
              fieldDefinitions {
                name
                key
              }
            }
            userErrors {
              field
              message
              code
            }
          }
        }`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    // First check if the metaobject definition already exists
    const checkResponse = await admin.graphql(
      `#graphql
      query {
        metaobjectDefinitions(first: 50) {
          edges {
            node {
              name
              type
            }
          }
        }
      }`,
    );

    const checkResult = await checkResponse.json();
    const definitions = checkResult?.data?.metaobjectDefinitions?.edges || [];
    const existsList = definitions.some(
      (edge: any) => edge.node.type === "instagram-list",
    );
    const existsPost = definitions.some(
      (edge: any) => edge.node.type === "instagram-post",
    );

    let createdList = false;
    let createdPost = false;
    let errors: string[] = [];

    // Create post definition if missing
    if (!existsPost) {
      const postResponse = await admin.graphql(MetaobjectDefinition, {
        variables: {
          definition: {
            name: "Instagram Post",
            type: "instagram-post",
            description: "A metaobject definition for Instagram posts",
            access: {
              storefront: "PUBLIC_READ",
            },
            capabilities: {
              publishable: {
                enabled: false,
              },
            },
            fieldDefinitions: [
              {
                key: "data",
                name: "Data",
                type: "json",
                required: true,
              },
              {
                key: "images",
                name: "Images",
                type: "list.file_reference",
              },
              {
                key: "caption",
                name: "Caption",
                type: "multi_line_text_field",
              },
              {
                key: "likes",
                name: "Likes",
                type: "number_integer",
              },
              {
                key: "comments",
                name: "Comments",
                type: "number_integer",
              },
            ],
          },
        },
      });

      const postResult = await postResponse.json();
      if (
        postResult?.data?.metaobjectDefinitionCreate?.userErrors?.length > 0
      ) {
        errors = errors.concat(
          postResult.data.metaobjectDefinitionCreate.userErrors.map(
            (err: any) => `${err.field?.join(".")}: ${err.message}`,
          ),
        );
        console.error("Metaobject post creation errors:", errors);
      } else if (
        postResult?.data?.metaobjectDefinitionCreate?.metaobjectDefinition
      ) {
        createdPost = true;
        console.log(
          "Metaobject post definition created:",
          postResult.data.metaobjectDefinitionCreate.metaobjectDefinition,
        );
      }
    }

    // Create list definition if missing
    if (!existsList) {
      // First, get the instagram-post definition ID
      const postDefQuery = await admin.graphql(
        `#graphql
        query {
          metaobjectDefinitions(first: 50) {
            edges {
              node {
                id
                type
              }
            }
          }
        }`,
      );

      const postDefResult = await postDefQuery.json();
      const postDef = postDefResult?.data?.metaobjectDefinitions?.edges?.find(
        (edge: any) => edge.node.type === "instagram-post",
      );

      if (!postDef) {
        errors.push(
          "Instagram Post definition must be created before Instagram List",
        );
        return {
          apiKey: process.env.SHOPIFY_API_KEY || "",
          existsList,
          existsPost,
          createdList,
          createdPost,
          errors,
        };
      }

      const postDefinitionId = postDef.node.id;

      const listResponse = await admin.graphql(MetaobjectDefinition, {
        variables: {
          definition: {
            name: "Instagram List",
            type: "instagram-list",
            description: "A metaobject definition for Instagram lists",
            access: {
              storefront: "PUBLIC_READ",
            },
            capabilities: {
              publishable: {
                enabled: false,
              },
            },
            fieldDefinitions: [
              {
                key: "data",
                name: "Data",
                type: "json",
                required: true,
              },
              {
                key: "posts",
                name: "Posts",
                type: "list.metaobject_reference",
                validations: [
                  {
                    name: "metaobject_definition_id",
                    value: postDefinitionId,
                  },
                ],
                required: true,
              },
              {
                key: "username",
                name: "Username",
                type: "single_line_text_field",
                required: true,
              },
              {
                key: "name",
                name: "displayName",
                type: "single_line_text_field",
                required: true,
              },
            ],
          },
        },
      });

      const listResult = await listResponse.json();
      if (
        listResult?.data?.metaobjectDefinitionCreate?.userErrors?.length > 0
      ) {
        errors = errors.concat(
          listResult.data.metaobjectDefinitionCreate.userErrors.map(
            (err: any) => `${err.field?.join(".")}: ${err.message}`,
          ),
        );
        console.error("Metaobject list creation errors:", errors);
      } else if (
        listResult?.data?.metaobjectDefinitionCreate?.metaobjectDefinition
      ) {
        createdList = true;
        console.log(
          "Metaobject list definition created:",
          listResult.data.metaobjectDefinitionCreate.metaobjectDefinition,
        );
      }
    }

    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      existsList,
      existsPost,
      createdList,
      createdPost,
      errors,
    };
  } catch (error) {
    console.error("Error in metaobject definition creation:", error);
    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      exists: false,
      created: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function Index() {
  const { apiKey, existsList, existsPost, createdList, createdPost, errors } =
    useLoaderData<typeof loader>() as any;
  const navigate = useNavigate();

  const isSetupComplete =
    (existsList || createdList) && (existsPost || createdPost);
  const hasErrors = errors && errors.length > 0;

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
      </s-app-nav>
      <Outlet />

      <s-page>
        {/* Hero Section */}
        <s-section>
          <s-box padding="large-500">
            <s-stack gap="large" alignItems="center">
              <s-box>
                <s-heading>
                  <s-heading>
                    <s-heading>NN Instagram</s-heading>
                  </s-heading>
                </s-heading>
              </s-box>
              <s-box maxInlineSize="600px">
                <s-stack gap="none" alignItems="center">
                  <s-text>
                    Sync your Instagram posts to Shopify and display them beautifully on your store
                  </s-text>
                </s-stack>
              </s-box>
            </s-stack>
          </s-box>
        </s-section>

        {/* Two Column Layout */}
        <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base">
          {/* Left Column - Main Content (spans 2 columns) */}
          <s-grid-item gridColumn="span 2">
            {/* About the App Section */}
            <s-section>
            <s-card>
              <s-stack gap="base">
              <s-stack gap="small-200">
                <s-heading>About the App</s-heading>
                <s-text color="subdued">
                  Instagram Feed Sync - Seamlessly integrate your Instagram content with Shopify
                </s-text>
              </s-stack>

              <s-divider />

              <s-stack gap="base">
                <s-stack gap="small-200">
                  <s-text type="strong">What does this app do?</s-text>
                  <s-text>
                    This app automatically syncs your Instagram posts to your Shopify store, 
                    storing them as metaobjects and files. You can then display your Instagram 
                    feed anywhere on your store using Liquid code or theme blocks.
                  </s-text>
                </s-stack>

                <s-stack gap="small-200">
                  <s-text type="strong">Key Features</s-text>
                  <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
                    <s-grid-item>
                      <s-stack direction="inline" gap="small-200">
                        <s-icon type="check" tone="success" />
                        <s-text>Automatic sync every 24 hours</s-text>
                      </s-stack>
                    </s-grid-item>
                    <s-grid-item>
                      <s-stack direction="inline" gap="small-200">
                        <s-icon type="check" tone="success" />
                        <s-text>Manual sync on demand</s-text>
                      </s-stack>
                    </s-grid-item>
                    <s-grid-item>
                      <s-stack direction="inline" gap="small-200">
                        <s-icon type="check" tone="success" />
                        <s-text>Stores posts as metaobjects</s-text>
                      </s-stack>
                    </s-grid-item>
                    <s-grid-item>
                      <s-stack direction="inline" gap="small-200">
                        <s-icon type="check" tone="success" />
                        <s-text>Uploads media to Shopify files</s-text>
                      </s-stack>
                    </s-grid-item>
                    <s-grid-item>
                      <s-stack direction="inline" gap="small-200">
                        <s-icon type="check" tone="success" />
                        <s-text>Easy theme integration</s-text>
                      </s-stack>
                    </s-grid-item>
                    <s-grid-item>
                      <s-stack direction="inline" gap="small-200">
                        <s-icon type="check" tone="success" />
                        <s-text>No coding required</s-text>
                      </s-stack>
                    </s-grid-item>
                  </s-grid>
                </s-stack>

                <s-stack gap="small-200">
                  <s-text type="strong">How it works</s-text>
                  <s-stack gap="small-100">
                    <s-text>
                      <strong>1.</strong> Connect your Instagram Business account
                    </s-text>
                    <s-text>
                      <strong>2.</strong> Sync your posts to create metaobjects and files in Shopify
                    </s-text>
                    <s-text>
                      <strong>3.</strong> Add the Instagram feed to your store pages using theme blocks
                    </s-text>
                    <s-text>
                      <strong>4.</strong> Your feed updates automatically every 24 hours
                    </s-text>
                  </s-stack>
                </s-stack>

                <s-divider />

                <s-stack gap="small-200">
                  <s-text type="strong">Requirements</s-text>
                  <s-stack gap="small-100">
                    <s-text color="subdued">• Instagram Business or Creator account</s-text>
                    <s-text color="subdued">• Facebook Page connected to Instagram</s-text>
                    <s-text color="subdued">• Shopify plan that supports metaobjects</s-text>
                  </s-stack>
                </s-stack>

                <s-banner tone="info">
                  <s-stack gap="small-200">
                    <s-text type="strong">Need help?</s-text>
                    <s-text>
                      Visit our documentation or contact support for assistance with setup and customization.
                    </s-text>
                  </s-stack>
                </s-banner>
              </s-stack>
            </s-stack>
          </s-card>
          </s-section>
        </s-grid-item>

        {/* Right Column - Sidebar (spans 1 column) */}
        <s-grid-item gridColumn="span 1">
          {/* Next Steps */}
          {isSetupComplete && !hasErrors && (
            <s-section>
            <s-card>
              <s-stack gap="base">
                <s-heading>Next Steps</s-heading>

                <s-stack gap="base">
                  <s-stack gap="small-100">
                    <s-text type="strong">1. Connect Your Account</s-text>
                    <s-text color="subdued">
                      Head to the dashboard and connect your Instagram Business
                      account
                    </s-text>
                  </s-stack>

                  <s-stack gap="small-100">
                    <s-text type="strong">2. Sync Your Posts</s-text>
                    <s-text color="subdued">
                      Import your Instagram posts with one click
                    </s-text>
                  </s-stack>

                  <s-stack gap="small-100">
                    <s-text type="strong">3. Add to Your Theme</s-text>
                    <s-text color="subdued">
                      Display your Instagram feed on any page of your store
                    </s-text>
                  </s-stack>
                </s-stack>

                <s-divider />

                <s-button variant="primary" onClick={() => navigate("/app")}>
                  Get Started →
                </s-button>
              </s-stack>
            </s-card>
            </s-section>
          )}
          
          {/* App Setup Section */}
          <s-section>
              <s-card>
              <s-stack gap="base">
                <s-stack direction="inline" gap="small-200">
                  <s-heading>App Setup</s-heading>
                  {isSetupComplete && !hasErrors && (
                    <s-badge tone="success">Ready</s-badge>
                  )}
                  {hasErrors && (
                    <s-badge tone="critical">Action Required</s-badge>
                  )}
                </s-stack>

                {/* Success Banner */}
                {isSetupComplete && !hasErrors && (
                  <s-banner tone="success">
                    <s-stack gap="small-200">
                      <s-text type="strong">The app is ready to use!</s-text>
                      <s-text>
                        All required metaobject definitions have been created
                        successfully.
                      </s-text>
                    </s-stack>
                  </s-banner>
                )}

                {/* Error Banner */}
                {hasErrors && (
                  <s-banner tone="critical">
                    <s-stack gap="small-200">
                      <s-text type="strong">Setup encountered errors</s-text>
                      <s-text>
                        Please check the details below and contact support if the
                        issue persists.
                      </s-text>
                    </s-stack>
                  </s-banner>
                )}

                <s-divider />

                {/* Setup Details */}
                <s-stack gap="base">
                  <s-text type="strong">Metaobject Definitions</s-text>

                  {/* Instagram Post Status */}
                  <s-stack gap="small-200" direction="inline">
                    {(existsPost || createdPost) && !hasErrors ? (
                      <s-icon type="check-circle" tone="success" />
                    ) : (
                      <s-icon type="alert-circle" tone="critical" />
                    )}
                    <s-stack gap="small-100">
                      <s-text type="strong">Instagram Post</s-text>
                      <s-text color="subdued">
                        {createdPost && "Created during setup"}
                        {existsPost && !createdPost && "Already configured"}
                        {!existsPost && !createdPost && "Not configured"}
                      </s-text>
                    </s-stack>
                  </s-stack>

                  {/* Instagram List Status */}
                  <s-stack gap="small-200" direction="inline">
                    {(existsList || createdList) && !hasErrors ? (
                      <s-icon type="check-circle" tone="success" />
                    ) : (
                      <s-icon type="alert-circle" tone="critical" />
                    )}
                    <s-stack gap="small-100">
                      <s-text type="strong">Instagram List</s-text>
                      <s-text color="subdued">
                        {createdList && "Created during setup"}
                        {existsList && !createdList && "Already configured"}
                        {!existsList && !createdList && "Not configured"}
                      </s-text>
                    </s-stack>
                  </s-stack>
                </s-stack>

                {/* Error Details */}
                {hasErrors && (
                  <>
                    <s-divider />
                    <s-stack gap="small-200">
                      <s-text type="strong">Error Details:</s-text>
                      {errors.map((err: string, i: number) => (
                        <s-text key={i} color="subdued">
                          • {err}
                        </s-text>
                      ))}
                    </s-stack>
                  </>
                )}

                {/* Action Button */}
                {isSetupComplete && !hasErrors && (
                  <>
                    <s-divider />
                    <s-box>
                      <s-button
                        variant="primary"
                        onClick={() => navigate("/app")}
                      >
                        Go to Dashboard →
                      </s-button>
                    </s-box>
                  </>
                )}
              </s-stack>
            </s-card>
            </s-section>
          </s-grid-item>
        </s-grid>
      </s-page>
    </AppProvider>
  );
}
