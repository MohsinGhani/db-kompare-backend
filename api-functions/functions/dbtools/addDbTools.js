import { v4 as uuidv4 } from "uuid";
import { DB_TOOL_STATUS, TABLE_NAME } from "../../helpers/constants.js";
import { sendResponse } from "../../helpers/helpers.js";
import { fetchAlldbToolsCategories } from "../common/fetchAlldbToolsCategories.js";
import { dbToolsData } from "../../helpers/dummy_data.js";
import DynamoDB from "aws-sdk/clients/dynamodb.js";
import { batchWriteItems } from "../../helpers/dynamodb.js";

export const handler = async (event) => {
  try {
    // Fetch all database tools categories
    const allCategories = await fetchAlldbToolsCategories();
    console.log("dbToolsData", dbToolsData.length);
    // Map dbToolsData to replace category_name with category id
    const data = dbToolsData.slice(200, 250).map((item) => {
      const core_features = [
        item["CORE FEATURES"],
        item["Column_22"],
        item["Column_23"],
        item["Column_24"],
        item["Column_25"],
        item["Column_26"],
        item["Column_27"],
        item["Column_28"],
        item["Column_29"],
        item["Column_30"],
        item?.["Column_31"],
        item?.["Column_32"],
        item?.["Column_33"],
        item?.["Column_34"],
      ].filter(Boolean); // Remove any empty or null values

      const {
        category_name, // The original category name
        tool_name,
        tool_description,
        "Category Description": category_description,
        "Home Page URL": home_page_url,
        "Access control": access_control,
        "Version Control": version_control,
        "Support for workflow": support_for_workflow,
        "Web Access": web_access,
        "Deployment Options On-prem OR SaaS":
          deployment_options_on_prem_or_saas,
        "Free Community edition": free_community_edition,
        "Authentication \nProtocol \nSupported":
          authentication_protocol_supported,
        "API Integration with upstream / downstream systems":
          api_integration_with_upstream_downstream_systems,
        "user created tags/comments": user_created_tags_comments,
        "Customization possible": customization_possible,
        "Modern ways of Deployment": modern_ways_of_deployment,
        "Support \nImport / Export \nFormats": support_import_export_formats,
        "Useful Links": useful_links,
        "Price (USD or EUR)": price,
        "DBKompare View": dbkompare_view,
        "AI Capabilities": ai_capabilities,
      } = item;

      // Find the matching category in the fetched categories
      const matchingCategory = allCategories.find(
        (category) => category?.name === category_name
      );
      return {
        id: uuidv4(),
        category_id: matchingCategory?.id || null, // Use the ID if found, otherwise null
        tool_name,
        tool_description,
        home_page_url,
        access_control,
        version_control,
        support_for_workflow,
        web_access,
        deployment_options_on_prem_or_saas,
        free_community_edition,
        authentication_protocol_supported,
        api_integration_with_upstream_downstream_systems,
        user_created_tags_comments,
        customization_possible,
        modern_ways_of_deployment,
        support_import_export_formats,
        useful_links,
        price,
        dbkompare_view,
        ai_capabilities,
        core_features,
        status: DB_TOOL_STATUS.ACTIVE,
      };
    });

    // Validate the data
    if (!Array.isArray(data) || data.length === 0) {
      return sendResponse(400, "Invalid input: No data to process.");
    }

    const tableName = TABLE_NAME.DB_TOOLS;

    // Write the data to DynamoDB
    await batchWriteItems(tableName, data);

    return sendResponse(200, "DB tools added successfully.", data);
  } catch (error) {
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
