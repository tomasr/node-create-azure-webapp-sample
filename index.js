const parseArgs = require('minimist')
const Azure = require('azure');
const MsRest = require('ms-rest-azure');
const WebAppManagementClient = require('azure-arm-website');
const ResourceManagement = require('azure-arm-resource');

let resources = {
    credentials: null,
    resourceGroup: null,
    webHostingPlan: null,
    webApp: null,
    appInsightsExtension: null,
    appInsights: null
};

class AppCreator {
    constructor(params) {
        this.location = params.location;
        this.tenantId = params.tenant;
        this.subscriptionId = params.subscription;
        this.resourceGroupname = params.group;
        this.webAppName = params.appname;
        this.webPlanName = this.webAppName + "-asp";
        this.appInsightsName = this.webAppName;
        this.appInsightsExtName = this.webAppName + "-ai";
        this.webPlanTier = 'F1';
        this.webPlanCapacity = 1;
    }

    login() {
        return MsRest.interactiveLogin({ domain: this.tenantId });
    }

    createResourceGroup(resourceInfo) {
        var group =  {
            location: this.location
        };
        let rgmanagement = new ResourceManagement.ResourceManagementClient(resourceInfo.credentials, this.subscriptionId);
        return rgmanagement.resourceGroups.createOrUpdate(this.resourceGroupName, group)
    }

    createAppInsights(resourceInfo) {
        var envelope = {
            location: this.location,
            properties: {}
        };
        let management = new ResourceManagement.ResourceManagementClient(resourceInfo.credentials, this.subscriptionId);
        return management.resources.createOrUpdate(
            this.resourceGroupName, // resource group
            'microsoft.insights',   // provider namespace
            '',                     // parent resource
            'components',           // resource type
            this.appInsightsName,   // resource name
            '2014-04-01',           // api version
            envelope);          
    }

    createHostingPlan(resourceInfo) {
        var info = {
            location: this.location,
            sku: {
                name: this.webPlanTier,
                capacity: this.webPlanCapacity
            }
        };
        let wam = new WebAppManagementClient(resourceInfo.credentials, this.subscriptionId);
        return wam.appServicePlans.createOrUpdate(this.resourceGroupName, this.webPlanName, info);
    }

    createWebApp(resourceInfo) {
        var envelope = {
            name: this.webAppname,
            location: this.location,
            kind: 'web',
            serverFarmId: resourceInfo.webHostingPlan.id,
            properties: {
            },
            siteConfig: {
                appSettings: [
                    {
                        name: 'APPINSIGHTS_INSTRUMENTATIONKEY', 
                        value: resourceInfo.appInsights.properties.InstrumentationKey
                    }
                ]
            }
        };
        let wam = new WebAppManagementClient(resourceInfo.credentials, this.subscriptionId);
        return wam.webApps.createOrUpdate(this.resourceGroupName, this.webAppName, envelope);
    }

    addAppInsightsExtension(resourceInfo) {
        var envelope = {
            location: this.location,
            properties: {}
        };
        let management = new ResourceManagement.ResourceManagementClient(resourceInfo.credentials, this.subscriptionId);
        return management.resources.createOrUpdate(
            this.resourceGroupName,                         // resource group
            'Microsoft.Web/sites',                          // provider namespace
            this.webAppName,                                // parent resource
            'siteextensions',                               // resource type
            'Microsoft.ApplicationInsights.AzureWebSites',  // resource name
            '2015-08-01',                                   // api version
            envelope);          
    }
}


if ( process.argv.length < 2 ) {
    console.log('usage: <command> -tenant <tenant_id> -subscription <id> -location <region> -group <resource_group> -appname <webapp_name>');
    process.exit(-1);
}

const argv = parseArgs(process.argv.slice(2));

const creator = new AppCreator(argv);

creator.login(resources)
    .then(credentials => {
        console.log('login completed');
        resources.credentials = credentials;
        return appCreator.createResourceGroup(resources);
    }).then(resourceGroup => {
        resources.resourceGroup = resourceGroup;
        console.log('Resource Group created: ' + resourceGroup.id);
        return appCreator.createAppInsights(resources);
    }).then(appInsights => {
        console.log(appInsights);
        resources.appInsights = appInsights;
        console.log('App Insights created: ' + appInsights.id);
        return appCreator.createHostingPlan(resources);
    }).then(servicePlan => {
        console.log('Hosting plan created: ' + servicePlan.id);
        resources.webHostingPlan = servicePlan;
        return appCreator.createWebApp(resources);
    }).then(webApp => {
        resources.webApp = webApp;
        console.log('Web App created: ' + webApp.id);
        return appCreator.addAppInsightsExtension(resources);
    }).then(aiExtension => {
        resources.appInsightsExtension = aiExtension;
        console.log('AppInsights extension created: ' + aiExtension.id);
    });