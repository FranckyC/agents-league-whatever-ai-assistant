import { Client } from "@microsoft/microsoft-graph-client";

const SDK_VERSION = "Whatever AI AssistantBot/1.0.0";

export interface Extract {
    text: string;
}

export interface RetrievalDocument {
    title: string;
    url: string;
    extracts: Extract[];
}

export interface DataSourceConfiguration {
    externalItem?: {
        connections: Array<{ connectionId: string }>;
    };
    [key: string]: any; // Allow for other data source types
}

export enum CopilotDataSource {
        SharePoint = "sharePoint",
        ExternalItem = "externalItem",
        OneDriveForBusiness = "oneDriveBusiness"
}

export interface CopilotRetrievalRequest {
    queryString: string;
    dataSource?: CopilotDataSource;
    resourceMetadata?: string[];
    dataSourceConfiguration?: DataSourceConfiguration;
    maximumNumberOfResults?: number;
    filterExpression?: string;
}

export interface RetrievalHit {
    resourceMetadata?: {
        title?: string;
    };
    webUrl?: string;
    extracts?: any[];
}

export interface CopilotRetrievalResponse {
    retrievalHits?: RetrievalHit[];
}

/**
 * Retrives data from Microsoft Graph for LLM grounding purposes
 */
export class GraphService {

    private client: Client;

    constructor(accessToken: string) {

        this.client = Client.initWithMiddleware({
            authProvider: {
                getAccessToken: async () => {
                    return accessToken;
                },
            },
        });
    }

    /**
     * Searches Microsoft 365 Copilot retrieval API for grounding data.
     * 
     * Queries SharePoint documents or external items (e.g. DailyHub) via the
     * `POST /copilot/retrieval` endpoint and returns deduplicated, URL-grouped
     * results with text extracts suitable for LLM grounding.
     * 
     * @param request The retrieval request containing query string, data source type,
     *                filter expressions, and optional external item connection IDs.
     * @param language BCP-47 language tag (e.g. "fr-FR", "en-US") sent as the
     *                 `Accept-Language` header. Defaults to "en-US" if omitted.
     * @returns An array of {@link RetrievalDocument} objects grouped by URL, each
     *          containing a title, URL, and an array of text extracts.
     * @throws Rethrows any Graph API error after logging it.
     */
    async searchCopilotDataForGrounding(request: CopilotRetrievalRequest, language?: string): Promise<RetrievalDocument[]> {
  
        const bodyPayload = {
            queryString: request.queryString,
            dataSource: request.dataSource,
            resourceMetadata: request.resourceMetadata,
            dataSourceConfiguration: request.dataSourceConfiguration,
            maximumNumberOfResults: request.maximumNumberOfResults || 10,
            filterExpression: request.filterExpression
        };

        try {
            const response: CopilotRetrievalResponse = await this.client
                .api("/copilot/retrieval")
                .headers({ 
                  "SdkVersion": SDK_VERSION,  
                  "Accept-language": language ? language : "en-US" // "Accept-Language" is mandatory here or you won't get any results...
                }).post(bodyPayload);

            const retrievalHits = response?.retrievalHits || [];

            const formattedResponse = retrievalHits.reduce((acc, hit: any, index) => {
                acc = [...acc, ...hit.extracts.map((extract: any) => (
                    {
                        title: hit.resourceMetadata?.title || "",
                        url: (hit.webUrl || ""),
                        text: extract.text || "",
                        metadata: hit.resourceMetadata
                    }))];
                return acc;
            }, []);

            // Group by URL and nest text chunks in extracts array
            const groupedByUrl = formattedResponse.reduce((acc: any, chunk: any) => {
                const key = chunk.url || chunk.title;
                if (!acc[key]) {
                    acc[key] = {
                        title: chunk.title,
                        url: chunk.url,
                        extracts: [{ text: chunk.text }]
                    };
                } else {
                    acc[key].extracts.push({ text: chunk.text });
                }
                return acc;
            }, {});

            const finalResults: RetrievalDocument[] = Object.values(groupedByUrl);          

            return finalResults;

        } catch (error) {

            console.error('Retrieval API error:', error);
            
            throw error;
        }
    }

    /**
     * Parses an absolute SharePoint list URL into its constituent parts.
     * E.g. "https://sonbaedev.sharepoint.com/sites/it-portal/Lists/Tickets"
     *   → hostname: "sonbaedev.sharepoint.com"
     *   → siteRelativePath: "/sites/it-portal"
     *   → listName: "Tickets"
     */
    private parseSharePointListUrl(absoluteUrl: string): { hostname: string; siteRelativePath: string; listName: string } {
        const url = new URL(absoluteUrl);
        const hostname = url.hostname; // e.g. "sonbaedev.sharepoint.com"

        // The pathname looks like "/sites/it-portal/Lists/Tickets"
        // We need to split at "/Lists/" to get the site path and list name
        const listsIndex = url.pathname.toLowerCase().indexOf('/lists/');
        if (listsIndex === -1) {
            throw new Error(`Invalid SharePoint list URL — expected "/Lists/" segment in: ${absoluteUrl}`);
        }

        const siteRelativePath = url.pathname.substring(0, listsIndex); // "/sites/it-portal"
        const listName = url.pathname.substring(listsIndex + '/lists/'.length).replace(/\/+$/, ''); // "Tickets"

        if (!siteRelativePath || !listName) {
            throw new Error(`Could not parse site path or list name from URL: ${absoluteUrl}`);
        }

        return { hostname, siteRelativePath, listName };
    }

    /**
     * Creates a new item in a SharePoint list.
     * 
     * Accepts an absolute SharePoint list URL (e.g. https://tenant.sharepoint.com/sites/mysite/Lists/MyList)
     * and resolves the site and list via Graph API before creating the item.
     * 
     * Graph flow:
     *  1. GET /sites/{hostname}:/{siteRelativePath}  → siteId
     *  2. GET /sites/{siteId}/lists/{listName}        → listId
     *  3. POST /sites/{siteId}/lists/{listId}/items   → new item
     * 
     * @param listAbsoluteUrl The absolute URL of the SharePoint list.
     * @param itemData The item payload including a `fields` object with column internal names.
     */
    async createListItem(listAbsoluteUrl: string, itemData: { fields: Record<string, string> }): Promise<any> {

        try {
            const { hostname, siteRelativePath, listName } = this.parseSharePointListUrl(listAbsoluteUrl);

            // 1. Resolve the site by hostname + relative path
            const site = await this.client
                .api(`/sites/${hostname}:${siteRelativePath}`)
                .headers({ "SdkVersion": SDK_VERSION })
                .get();

            const siteId = site.id;

            // 2. Resolve the list by display name on that site
            const list = await this.client
                .api(`/sites/${siteId}/lists/${listName}`)
                .headers({ "SdkVersion": SDK_VERSION })
                .get();

            const listId = list.id;

            // 3. Create the list item
            const response = await this.client
                .api(`/sites/${siteId}/lists/${listId}/items`)
                .headers({ "SdkVersion": SDK_VERSION })
                .post(itemData);

            return response;

        } catch (error) {

            console.error('Error creating SharePoint list item:', error);
            throw error;
        }
    }
}
