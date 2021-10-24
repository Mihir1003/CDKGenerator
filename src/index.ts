import test from "./test.json"
import fs, { mkdirSync, RmDirOptions, rmdirSync, RmOptions, writeFile } from "fs"
import * as path from "path"
import { execSync, ExecSyncOptionsWithBufferEncoding } from "child_process"


let dependencies : any = []

enum AWSResourceType {
    LAMBDA = "lambda",
    APIGATEWAY = "apigateway",
    S3BUCKET = "s3bucket"
}

interface DSLSchema {
    resources: Resource[]
}

interface Resource {
    resourceType: AWSResourceType;
    resourceName: string;
    
}

interface LambdaResource {

}

class CDKPackageGenerator{
    
    constructor(readonly name: string) {

    }
}

class CDKStackGenerator {
    constructor(readonly DSLFile: string) {}
          

}


function runtimeParser(runtime : string) : string 
{ 
    let base = "lambda.Runtime."
    switch(runtime) {
        case "node12":
            return base + "NODEJS_12_X"
        default:
            return "undefined"

    }
 }

 function lambdaCodeParser(props : any) : string {
    
    switch(props.type) {
        case "S3":
            return `new lambda.Code.fromBucket(${props.dependencyName},${props.key ? `'${props.key}'` : 'your key here'})`
        case "Asset":
            return `new lambda.Code.fromAsset(path.join(__dirname, '${props.path}'))`    
        default:
            return "undefined"
    }
 }

function LambdaCodeGenerator(props: any) {
    let configs : any= {}
    configs.name = props.name
    configs.code = lambdaCodeParser(props.code)
    configs.runtime = runtimeParser(props.code.runtime)
    configs.handler = props.code.handler
    dependencies.push(configs.name)
    console.log(dependencies,props.code.dependencyName)
    return {
        imports: `import * as lambda from '@aws-cdk/aws-lambda';
                  import * as path from 'path';`,
        construct: `let ${configs.name} = new lambda.Function(this,'${configs.name}',{
            code: ${configs.code},
            runtime: ${configs.runtime},
            handler: "${configs.handler}"
          })`
    }
}


function BucketCodeGenerator(props: any) {
    let configs : any= {}
    configs.name = props.name
    dependencies.push(configs.name)
    return {
        imports: "import * as s3 from '@aws-cdk/aws-s3'",
        construct: `let ${configs.name} = new s3.Bucket(this,'${configs.name}',{})`
    }

}

function ApiGatewayGenerator(props:any) {
    let configs: any = {}
    configs.name = props.name
    dependencies.push(configs.name)
    return {
        imports: "import * as apigateway from '@aws-cdk/aws-apigateway'",
        construct: `let ${configs.name} = new apigateway.LambdaRestApi(this,'${configs.name}',{
            handler: ${props.triggers.dependencyName}
        })`
    }
}

let imports : string[]= []
let constructs :string[]= []
function Generator(json: any) : string {
    let resources = json.resources

    resources.map((resource: any)=>handleResource(resource)).forEach((element : any)=> {
        
        imports.push(element.imports)
        constructs.push(element.construct)
    });

    return `import * as cdk from '@aws-cdk/core';
    ${imports.reduce((prev: string,cur: string)=> {
        return prev+"\n"+cur
    })}
    
    export class HelloCdkStack extends cdk.Stack{

        constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
            super(scope, id, props);
            
            ${constructs.reduce((prev: string,cur: string)=> {
                return prev+"\n"+cur
            })}
        }
    }
    `
}

function handleResource(resource : any) {
    switch (resource.resource) {
        case "Lambda":
            return LambdaCodeGenerator(resource)
        case "ApiGateway":
            return ApiGatewayGenerator(resource)
        case "S3Bucket":
            return BucketCodeGenerator(resource)
    }
}





function writeStack(path: string, code: string) {
    fs.writeFile(path,code, 'utf8',(err)=> {
        if (err) throw err;
        console.log('The file has been saved!');
    })
}







function packageGenerator() {
    
    if (fs.existsSync("build")) {
        let options :RmOptions = {
            force: true,
            recursive: true
        }
        rmdirSync("build",options)
    }

    mkdirSync("build");
    execSync("cd build && cdk init app --language typescript")
    writeStack("build/lib/build-stack.ts",Generator(test))

}

packageGenerator()