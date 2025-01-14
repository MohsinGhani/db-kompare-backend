import { batchWriteItems } from "../../helpers/dynamodb.js";
import { v4 as uuidv4 } from "uuid";
import { DB_TOOL_STATUS, TABLE_NAME } from "../../helpers/constants.js";
import { getTimestamp, sendResponse } from "../../helpers/helpers.js";

export const handler = async (event) => {
  try {
    // Parse the input JSON from the request body
    const categories = [
      {
        category: "Business Intelligence / Reporting Tools",
        description:
          "BI reporting—preparing, analyzing, and portraying business metrics—is fundamental to every business. This article will walk you through the basics you need to know. BI Reporting is divided into two categories in business intelligence. Managed reporting occurs when a technical employee such as an IT associate or data analyst prepares the data for non-technical users. Ad-hoc reporting in a BI platform allows non-technical users to create reports from scratch or edit pre-existing reports without having to make requests from IT. Reports allow business users to see data trends over time, slice and dice tables to discover relationships between variables. Smart BI tools have features like Natural Language Processing (NLP) so users can query the data using questions without coding. Reports can take various formats: tables, spreadsheets, and PDFs are all common outputs. Visualizations can include charts, graphs, or histograms. Reports can also be customized dashboards accessed through a web browser. With current technology, BI reports can be automated, and run on a pre-determined schedule.",
      },
      {
        category: "Data Compare Tools",
        description:
          "Tools used to compare and synchronize data across databases or files.",
      },
      {
        category: "Data Generation Tools",
        description:
          "These technologies help create realistic synthetic data. It enables testers to generate diverse and representative test datasets. These datasets closely mimic real-world data while protecting sensitive information.",
      },
      {
        category: "Data Governance Tools",
        description:
          "Data governance is a data management concept concerning the capability that enables an organization to ensure that high data quality exists throughout the complete lifecycle of the data, and data controls are implemented that support business objectives. The key focus areas of data governance include availability, usability, consistency, standards compliance, data integrity and security, and standards compliance. The practice also includes establishing processes to ensure effective data management throughout the enterprise, such as accountability for the adverse effects of poor data quality, and ensuring that the data which an enterprise has can be utilized by the entire organization.",
      },
      {
        category: "Data Modeling Tools",
        description:
          "Data Model, ML Model, and AI Model are distinct concepts in the field of data and machine learning. Here’s a brief explanation of each:\n\nData Model:\n\nA data model is a conceptual representation or structure that defines how data is organized, stored, and manipulated within a system or application.\nIt specifies the relationships between different data entities, the attributes of those entities, and the rules governing the data.\nData models can be represented using diagrams such as entity-relationship diagrams (ERDs) or through schema definitions in databases.\nML Model (Machine Learning Model):\n\nAn ML model is a mathematical or computational representation of a real-world process or problem that can be learned from data.\nML models are created using machine learning algorithms and techniques to analyze and learn patterns from training data.\nThese models are then used to make predictions or decisions on new, unseen data.\nExamples of ML models include linear regression, decision trees, support vector machines, neural networks, etc.\nAI Model (Artificial Intelligence Model):\n\nAn AI model is a broader term that encompasses ML models and other advanced techniques used to mimic or simulate human intelligence.\nAI models can include ML models but may also involve additional components such as natural language processing, computer vision, knowledge representation, and reasoning.\nThese models are designed to perform tasks that typically require human intelligence, such as understanding and generating natural language, recognizing objects in images, or making complex decisions. \nSUMMARY:\nData model represents the structure and organization of data, an ML model is a learned model that can make predictions based on data, and an AI model is a broader term encompassing ML models and other advanced techniques used to simulate human intelligence. These concepts are all interconnected but have distinct purposes and scopes in the realm of data and machine learning.",
      },
      {
        category: "Data Platform",
        description:
          "A data platform is an integrated set of technologies that collectively meet an organization's end-to-end data needs. It enables the acquisition, storage, preparation, delivery, and governance of your data, as well as a security layer for users and applications\nAn artificial intelligence (AI) platform is an integrated collection of technologies to develop, train, and run machine learning models. This typically includes automation capabilities, machine learning operations (MLOps), predictive data analytics, and more.",
      },
      {
        category: "Data Privacy & Security",
        description:
          "Data privacy compliance refers to the practices, policies, and procedures an organization implements to ensure they adhere to all legal regulations and standards concerning their users’ private information. These regulations balance a company’s need for collecting user data and an individual’s right to control their personal information. \nData Privacy Law: Major Regulations and Common Requirements \nDifferent jurisdictions often have unique data privacy regulations and laws, making it crucial to adhere to rules specific to your jurisdiction. While each law has its own requirements, data privacy compliance typically consists of certain common practices, such as the following: \n\n#1Cybersecurity measures that prevent unauthorized access. \nTransparent communication about how user information is collected, stored, and used. \n#2Providing users with options regarding which parties receive their personal data. \n#3Respecting users’ choice to opt out of data collection. In some jurisdictions, your organization may not be permitted to collect any personal information unless the user opts in first. \n#4Respecting individuals’ rights and acting on specific requests relating to their personal data processing. \n#5Ensuring third parties with whom you share consumer data meet certain security and privacy standards. \n#6ransparent and timely communication regarding data breaches.",
      },
      {
        category: "ETL/ELT Tools",
        description:
          "ETL : A Classic Approach to Database Management. Extract denotes the collection of data.\n\nTransform denotes processes that are performed on that data to configure it for usefulness or storage; for example, data might be sorted, or filtered, or combined with another source. In a traditional ETL process, transformation happens in a staging area outside of the data warehouse.\n\nFinally, load denotes the amount of data sent to a destination (usually a data warehouse or data lake) where it can be used.\nELT: Transformation happens in the data warehouse itself, usually when the data is queried. When the query comes in, the data is transformed for usability according to that query and then served appropriately.\nThis eliminates the need for a staging area outside of the data warehouse, and it also makes the process of loading data quicker, because transformation doesn’t have to happen before data can be loaded.\nData ingestion (NEW CONCEPT) is increasingly becoming standard parlance, but it’s actually a relatively new piece of jargon, especially in comparison to terms like ETL. data ingestion is the compilation of data from assorted sources into a storage medium where it can be accessed for use. Today, this process is ubiquitous in enterprise organizations due to the sheer amount of data that’s generated.\nFor instance, any organization with internet-of-things (IoT) devices almost certainly has a data ingestion pipeline set up so that those devices can be tracked and analyzed. Likewise, any organization with multiple customer data sources likely employs data ingestion to bring those sources together for use.",
      },
      {
        category: "Enterprise Architecture Tools",
        description:
          "Enterprise architecture is a strategic framework that aligns an organization's business strategy, processes, information, and technology to achieve its goals. It provides a holistic view of the organization, enabling effective decision-making, optimization of resources, and adaptation to changes in the business environment.\nKey Components:\nBusiness architecture\nData architecture\nTechnology architecture\nSecurity architecture",
      },
      {
        category: "SQL BUILDER Tools",
        description:
          "Query Builder provides a graphical user interface for creating SQL queries. You can drag-and-drop multiple tables, views and their columns onto a visual designer to generate SQL statements. You can use Query Builder to perform the following tasks: Working with a graphical representation of a query or with SQL code",
      },
    ];

    const updatedCategories = categories.map((t) => ({
      id: uuidv4(),
      name: t.category,
      description: t.description,
      CreatedAt: getTimestamp(),
      UpdatedAt: getTimestamp(),
      status: DB_TOOL_STATUS.ACTIVE,
    }));

    // Validate input
    if (!Array.isArray(categories) || categories.length === 0) {
      return sendResponse(400, "Invalid input: Provide a list of categories.");
    }
    const tableName = TABLE_NAME.DB_TOOL_CATEGORIES;
    // Use the provided batchWriteItems function
    await batchWriteItems(tableName, updatedCategories);

    return sendResponse(
      200,
      "Categories added successfully.",
      updatedCategories
    );
  } catch (error) {
    return sendResponse(500, "Internal Server Error", error.message);
  }
};
