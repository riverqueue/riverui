import type { Meta, StoryObj } from "@storybook/react";

import JSONView from "./JSONView";

const meta: Meta<typeof JSONView> = {
  component: JSONView,
  parameters: {
    layout: "centered",
  },
  title: "Components/JSONView",
};

export default meta;
type Story = StoryObj<typeof JSONView>;

// Sample JSON data
const simpleObject = {
  age: 30,
  email: "john@example.com",
  isActive: true,
  name: "John Doe",
};

const nestedObject = {
  person: {
    contact: {
      address: {
        city: "Anytown",
        country: "USA",
        street: "123 Main St",
      },
      email: "john@example.com",
      phone: "555-1234",
    },
    name: "John Doe",
  },
  preferences: {
    notifications: true,
    theme: "dark",
  },
  stats: {
    lastLogin: "2023-09-15T14:30:00Z",
    loginCount: 42,
  },
};

const arrayExample = [
  "apple",
  "banana",
  "cherry",
  "date",
  "elderberry",
  "fig",
  "grape",
];

const mixedExample = {
  emptyArray: [],
  emptyObject: {},
  items: [
    { id: 1, value: "first" },
    { id: 2, value: "second" },
    { id: 3, value: "third" },
  ],
  metadata: {
    count: 3,
    pageSize: 10,
    timestamp: "2023-09-15T14:30:00Z",
  },
  null: null,
  settings: {
    config: {
      retries: 3,
      timeout: 5000,
    },
    isEnabled: true,
  },
};

const longStringExample = {
  longString:
    "This is a very long string that should definitely wrap to multiple lines in the view. It contains enough text to demonstrate how the component handles long strings and text wrapping behavior.",
  mediumString: "This is a medium length string that should wrap",
  shortString: "Hello",
  url: "https://very-long-domain-name-for-testing-purposes-and-seeing-how-it-wraps.example.com/path/to/resource?param1=value1&param2=value2",
};

const bigJson = {
  customer: {
    accountCreated: "2022-01-15T08:30:00Z",
    email: "customer@example.com",
    id: "cus_abcdef123456",
    name: "Alice Customer",
    preferences: {
      language: "en-US",
      marketing: false,
      theme: "dark",
      timezone: "America/Los_Angeles",
    },
    subscription: {
      endDate: null,
      features: ["feature1", "feature2", "feature3", "feature4", "feature5"],
      interval: "monthly",
      plan: "premium",
      price: 29.99,
      startDate: "2022-02-01T00:00:00Z",
      status: "active",
    },
  },
  jobData: {
    attempts: 1,
    backoff: { initialInterval: 30, strategy: "exponential" },
    created: "2023-04-01T12:00:00Z",
    finished: "2023-04-01T12:00:15Z",
    id: "j_012345abcdef",
    kind: "ProcessPaymentJob",
    maxAttempts: 3,
    priority: 5,
    queueName: "payments",
    started: "2023-04-01T12:00:05Z",
    status: "completed",
  },
  metadata: {
    applicationVersion: "1.2.3",
    merchantId: "merch_12345abcde",
    referrer: "https://example.com/checkout",
    requestId: "req_zyxwvu987654",
    sessionId: "sess_abcdef123456",
    sourceIp: "192.168.1.100",
    tags: ["payment", "production", "high-value"],
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
  },
  paymentDetails: {
    amount: 129.99,
    cardDetails: {
      billingAddress: {
        city: "Finance City",
        country: "US",
        postalCode: "12345",
        state: "FC",
        street: "123 Payment Street",
      },
      expiryMonth: 4,
      expiryYear: 2025,
      lastFour: "4242",
      network: "Visa",
    },
    currency: "USD",
    method: "credit_card",
    transactionId: "txn_98765zyxwvu",
  },
  processingResults: {
    gatewayResponse: {
      authorizationCode: "AUTH123456",
      code: "approved",
      message: "Payment processed successfully",
      metadata: {
        gatewayId: "gateway_12345",
        processingTime: 1.23,
        retryCount: 0,
        route: "primary",
      },
      networkCode: "00",
      riskScore: 15,
    },
    logs: [
      {
        level: "info",
        message: "Payment processing started",
        timestamp: "2023-04-01T12:00:05Z",
      },
      {
        level: "debug",
        message: "Card validation successful",
        timestamp: "2023-04-01T12:00:06Z",
      },
      {
        details: {
          avsMessage: "Address and postal code match",
          avsResult: "Y",
        },
        level: "debug",
        message: "Address verification completed",
        timestamp: "2023-04-01T12:00:07Z",
      },
      {
        level: "info",
        message: "Payment gateway returned success response",
        timestamp: "2023-04-01T12:00:14Z",
      },
      {
        level: "info",
        message: "Payment processing completed successfully",
        timestamp: "2023-04-01T12:00:15Z",
      },
    ],
    success: true,
    timestamp: "2023-04-01T12:00:14Z",
  },
};

export const Simple: Story = {
  args: {
    copyTitle: "Simple Object",
    data: simpleObject,
    defaultExpandDepth: 5,
  },
};

export const Nested: Story = {
  args: {
    copyTitle: "Nested Object",
    data: nestedObject,
    defaultExpandDepth: 1,
  },
};

export const NestedCollapsed: Story = {
  args: {
    copyTitle: "Nested Object (All Keys Visible)",
    data: nestedObject,
    defaultExpandDepth: 0,
  },
};

export const NestedCollapsedHiddenKeys: Story = {
  args: {
    copyTitle: "Nested Object (Hidden Keys)",
    data: nestedObject,
    defaultExpandDepth: 0,
    hideNestedKeys: true,
  },
};

export const Array: Story = {
  args: {
    copyTitle: "Array",
    data: arrayExample,
    defaultExpandDepth: 1,
  },
};

export const Mixed: Story = {
  args: {
    copyTitle: "Mixed Data",
    data: mixedExample,
    defaultExpandDepth: 1,
  },
};

export const LongStrings: Story = {
  args: {
    copyTitle: "Long Strings",
    data: longStringExample,
    defaultExpandDepth: 3,
  },
};

export const LargeJSON: Story = {
  args: {
    copyTitle: "Large JSON",
    data: bigJson,
    defaultExpandDepth: 0,
  },
};
