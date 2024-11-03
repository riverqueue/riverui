/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from "./routes/__root"
import { Route as QueuesImport } from "./routes/queues"
import { Route as JobsImport } from "./routes/jobs"
import { Route as IndexImport } from "./routes/index"
import { Route as WorkflowsIndexImport } from "./routes/workflows/index"
import { Route as QueuesIndexImport } from "./routes/queues/index"
import { Route as JobsIndexImport } from "./routes/jobs/index"
import { Route as WorkflowsWorkflowIdImport } from "./routes/workflows/$workflowId"
import { Route as QueuesNameImport } from "./routes/queues/$name"
import { Route as JobsJobIdImport } from "./routes/jobs/$jobId"
import { Route as AboutAboutImport } from "./routes/about/about"

// Create/Update Routes

const QueuesRoute = QueuesImport.update({
  id: "/queues",
  path: "/queues",
  getParentRoute: () => rootRoute,
} as any)

const JobsRoute = JobsImport.update({
  id: "/jobs",
  path: "/jobs",
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  id: "/",
  path: "/",
  getParentRoute: () => rootRoute,
} as any)

const WorkflowsIndexRoute = WorkflowsIndexImport.update({
  id: "/workflows/",
  path: "/workflows/",
  getParentRoute: () => rootRoute,
} as any)

const QueuesIndexRoute = QueuesIndexImport.update({
  id: "/",
  path: "/",
  getParentRoute: () => QueuesRoute,
} as any)

const JobsIndexRoute = JobsIndexImport.update({
  id: "/",
  path: "/",
  getParentRoute: () => JobsRoute,
} as any)

const WorkflowsWorkflowIdRoute = WorkflowsWorkflowIdImport.update({
  id: "/workflows/$workflowId",
  path: "/workflows/$workflowId",
  getParentRoute: () => rootRoute,
} as any)

const QueuesNameRoute = QueuesNameImport.update({
  id: "/$name",
  path: "/$name",
  getParentRoute: () => QueuesRoute,
} as any)

const JobsJobIdRoute = JobsJobIdImport.update({
  id: "/$jobId",
  path: "/$jobId",
  getParentRoute: () => JobsRoute,
} as any)

const AboutAboutRoute = AboutAboutImport.update({
  id: "/about/about",
  path: "/about/about",
  getParentRoute: () => rootRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module "@tanstack/react-router" {
  interface FileRoutesByPath {
    "/": {
      id: "/"
      path: "/"
      fullPath: "/"
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    "/jobs": {
      id: "/jobs"
      path: "/jobs"
      fullPath: "/jobs"
      preLoaderRoute: typeof JobsImport
      parentRoute: typeof rootRoute
    }
    "/queues": {
      id: "/queues"
      path: "/queues"
      fullPath: "/queues"
      preLoaderRoute: typeof QueuesImport
      parentRoute: typeof rootRoute
    }
    "/about/about": {
      id: "/about/about"
      path: "/about/about"
      fullPath: "/about/about"
      preLoaderRoute: typeof AboutAboutImport
      parentRoute: typeof rootRoute
    }
    "/jobs/$jobId": {
      id: "/jobs/$jobId"
      path: "/$jobId"
      fullPath: "/jobs/$jobId"
      preLoaderRoute: typeof JobsJobIdImport
      parentRoute: typeof JobsImport
    }
    "/queues/$name": {
      id: "/queues/$name"
      path: "/$name"
      fullPath: "/queues/$name"
      preLoaderRoute: typeof QueuesNameImport
      parentRoute: typeof QueuesImport
    }
    "/workflows/$workflowId": {
      id: "/workflows/$workflowId"
      path: "/workflows/$workflowId"
      fullPath: "/workflows/$workflowId"
      preLoaderRoute: typeof WorkflowsWorkflowIdImport
      parentRoute: typeof rootRoute
    }
    "/jobs/": {
      id: "/jobs/"
      path: "/"
      fullPath: "/jobs/"
      preLoaderRoute: typeof JobsIndexImport
      parentRoute: typeof JobsImport
    }
    "/queues/": {
      id: "/queues/"
      path: "/"
      fullPath: "/queues/"
      preLoaderRoute: typeof QueuesIndexImport
      parentRoute: typeof QueuesImport
    }
    "/workflows/": {
      id: "/workflows/"
      path: "/workflows"
      fullPath: "/workflows"
      preLoaderRoute: typeof WorkflowsIndexImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

interface JobsRouteChildren {
  JobsJobIdRoute: typeof JobsJobIdRoute
  JobsIndexRoute: typeof JobsIndexRoute
}

const JobsRouteChildren: JobsRouteChildren = {
  JobsJobIdRoute: JobsJobIdRoute,
  JobsIndexRoute: JobsIndexRoute,
}

const JobsRouteWithChildren = JobsRoute._addFileChildren(JobsRouteChildren)

interface QueuesRouteChildren {
  QueuesNameRoute: typeof QueuesNameRoute
  QueuesIndexRoute: typeof QueuesIndexRoute
}

const QueuesRouteChildren: QueuesRouteChildren = {
  QueuesNameRoute: QueuesNameRoute,
  QueuesIndexRoute: QueuesIndexRoute,
}

const QueuesRouteWithChildren =
  QueuesRoute._addFileChildren(QueuesRouteChildren)

export interface FileRoutesByFullPath {
  "/": typeof IndexRoute
  "/jobs": typeof JobsRouteWithChildren
  "/queues": typeof QueuesRouteWithChildren
  "/about/about": typeof AboutAboutRoute
  "/jobs/$jobId": typeof JobsJobIdRoute
  "/queues/$name": typeof QueuesNameRoute
  "/workflows/$workflowId": typeof WorkflowsWorkflowIdRoute
  "/jobs/": typeof JobsIndexRoute
  "/queues/": typeof QueuesIndexRoute
  "/workflows": typeof WorkflowsIndexRoute
}

export interface FileRoutesByTo {
  "/": typeof IndexRoute
  "/about/about": typeof AboutAboutRoute
  "/jobs/$jobId": typeof JobsJobIdRoute
  "/queues/$name": typeof QueuesNameRoute
  "/workflows/$workflowId": typeof WorkflowsWorkflowIdRoute
  "/jobs": typeof JobsIndexRoute
  "/queues": typeof QueuesIndexRoute
  "/workflows": typeof WorkflowsIndexRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  "/": typeof IndexRoute
  "/jobs": typeof JobsRouteWithChildren
  "/queues": typeof QueuesRouteWithChildren
  "/about/about": typeof AboutAboutRoute
  "/jobs/$jobId": typeof JobsJobIdRoute
  "/queues/$name": typeof QueuesNameRoute
  "/workflows/$workflowId": typeof WorkflowsWorkflowIdRoute
  "/jobs/": typeof JobsIndexRoute
  "/queues/": typeof QueuesIndexRoute
  "/workflows/": typeof WorkflowsIndexRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | "/"
    | "/jobs"
    | "/queues"
    | "/about/about"
    | "/jobs/$jobId"
    | "/queues/$name"
    | "/workflows/$workflowId"
    | "/jobs/"
    | "/queues/"
    | "/workflows"
  fileRoutesByTo: FileRoutesByTo
  to:
    | "/"
    | "/about/about"
    | "/jobs/$jobId"
    | "/queues/$name"
    | "/workflows/$workflowId"
    | "/jobs"
    | "/queues"
    | "/workflows"
  id:
    | "__root__"
    | "/"
    | "/jobs"
    | "/queues"
    | "/about/about"
    | "/jobs/$jobId"
    | "/queues/$name"
    | "/workflows/$workflowId"
    | "/jobs/"
    | "/queues/"
    | "/workflows/"
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  JobsRoute: typeof JobsRouteWithChildren
  QueuesRoute: typeof QueuesRouteWithChildren
  AboutAboutRoute: typeof AboutAboutRoute
  WorkflowsWorkflowIdRoute: typeof WorkflowsWorkflowIdRoute
  WorkflowsIndexRoute: typeof WorkflowsIndexRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  JobsRoute: JobsRouteWithChildren,
  QueuesRoute: QueuesRouteWithChildren,
  AboutAboutRoute: AboutAboutRoute,
  WorkflowsWorkflowIdRoute: WorkflowsWorkflowIdRoute,
  WorkflowsIndexRoute: WorkflowsIndexRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/jobs",
        "/queues",
        "/about/about",
        "/workflows/$workflowId",
        "/workflows/"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/jobs": {
      "filePath": "jobs.tsx",
      "children": [
        "/jobs/$jobId",
        "/jobs/"
      ]
    },
    "/queues": {
      "filePath": "queues.tsx",
      "children": [
        "/queues/$name",
        "/queues/"
      ]
    },
    "/about/about": {
      "filePath": "about/about.tsx"
    },
    "/jobs/$jobId": {
      "filePath": "jobs/$jobId.tsx",
      "parent": "/jobs"
    },
    "/queues/$name": {
      "filePath": "queues/$name.tsx",
      "parent": "/queues"
    },
    "/workflows/$workflowId": {
      "filePath": "workflows/$workflowId.tsx"
    },
    "/jobs/": {
      "filePath": "jobs/index.tsx",
      "parent": "/jobs"
    },
    "/queues/": {
      "filePath": "queues/index.tsx",
      "parent": "/queues"
    },
    "/workflows/": {
      "filePath": "workflows/index.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
