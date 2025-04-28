import type { Meta, StoryObj } from "@storybook/react";

import { BadgeColors } from "@/components/Badge";
import { EditableBadge } from "@/components/job-search/EditableBadge";
import { useState } from "react";

const meta: Meta<typeof EditableBadge> = {
  argTypes: {
    color: {
      control: "select",
      options: BadgeColors,
    },
    content: { control: { type: "object" } },
    prefix: { control: "text" },
  },
  component: EditableBadge,
  parameters: {
    layout: "centered",
  },
  title: "Components/EditableBadge",
};

export default meta;
type Story = StoryObj<typeof EditableBadge>;

// Interactive story with state management
const EditableBadgeWithState = (
  args: React.ComponentProps<typeof EditableBadge>,
) => {
  const [content, setContent] = useState(args.content);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<null | string>(
    null,
  );

  const handleContentChange = (values: string[]) => {
    setContent(values);
  };

  return (
    <EditableBadge
      {...args}
      content={content}
      isEditing={isEditing}
      onContentChange={handleContentChange}
      onEditComplete={() => setIsEditing(false)}
      onEditStart={() => setIsEditing(true)}
      onRemove={() => console.log("Remove clicked")}
      onSuggestionApplied={() => setSelectedSuggestion(null)}
      selectedSuggestion={selectedSuggestion}
    />
  );
};

interface BadgeState {
  content: string[];
  id: string;
  isEditing: boolean;
}

// Create a proper React component for the AllColors story
const AllColorsComponent = () => {
  const [badges, setBadges] = useState<BadgeState[]>(
    BadgeColors.map((color) => ({
      content: [color],
      id: color,
      isEditing: false,
    })),
  );

  const handleContentChange = (id: string, newValues: string[]) => {
    setBadges((prev) =>
      prev.map((badge) =>
        badge.id === id ? { ...badge, content: newValues } : badge,
      ),
    );
  };

  const handleEditStart = (id: string) => {
    setBadges((prev) =>
      prev.map((badge) =>
        badge.id === id
          ? { ...badge, isEditing: true }
          : { ...badge, isEditing: false },
      ),
    );
  };

  const handleEditComplete = (id: string) => {
    setBadges((prev) =>
      prev.map((badge) =>
        badge.id === id ? { ...badge, isEditing: false } : badge,
      ),
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Editable Badges
        </h3>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          (click to edit)
        </p>
        <div className="flex flex-wrap gap-4">
          {badges.map((badge) => (
            <EditableBadge
              color={badge.id as (typeof BadgeColors)[number]}
              content={badge.content}
              isEditing={badge.isEditing}
              key={badge.id}
              onContentChange={(newValues) =>
                handleContentChange(badge.id, newValues)
              }
              onEditComplete={() => handleEditComplete(badge.id)}
              onEditStart={() => handleEditStart(badge.id)}
              onRemove={() => {}}
              prefix="filter:"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export const AllColors: Story = {
  render: () => <AllColorsComponent />,
};

// Create a proper React component for the EditingState story
const EditingStateComponent = () => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="space-y-4">
      <EditableBadge
        color="blue"
        content={["full-time", "contract"]}
        isEditing={isEditing}
        onContentChange={() => {}}
        onEditComplete={() => setIsEditing(false)}
        onEditStart={() => setIsEditing(true)}
        onRemove={() => {}}
        prefix="kind:"
      />
      <button
        className="mx-4 rounded-md bg-blue-500 px-3 py-1 text-white hover:bg-blue-600"
        onClick={() => setIsEditing(!isEditing)}
      >
        {isEditing ? "Exit Edit Mode" : "Enter Edit Mode"}
      </button>
    </div>
  );
};

export const EditingState: Story = {
  render: () => <EditingStateComponent />,
};

// Create a component demonstrating autocomplete suggestions
const AutocompleteDemoComponent = () => {
  const [content, setContent] = useState<string[]>(["react"]);
  const [isEditing, setIsEditing] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<null | string>(
    null,
  );

  const technologies = [
    "react",
    "vue",
    "angular",
    "svelte",
    "typescript",
    "javascript",
    "html",
    "css",
    "tailwind",
    "bootstrap",
    "material-ui",
    "chakra-ui",
    "node",
    "express",
    "nextjs",
    "gatsby",
    "graphql",
    "rest",
    "apollo",
    "redux",
    "jest",
    "testing-library",
    "cypress",
    "storybook",
  ];

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Autocomplete Demo</h3>
        <p className="text-sm text-slate-500">
          Type to see suggestions. Use arrow keys to navigate and Enter to
          select.
        </p>
      </div>

      <EditableBadge
        color="indigo"
        content={content}
        isEditing={isEditing}
        onContentChange={(values) => setContent(values)}
        onEditComplete={() => setIsEditing(false)}
        onEditingValueChange={(value) => {
          // This simulates selecting a suggestion when the user types exactly matching text
          const exact = technologies.find(
            (t) => t.toLowerCase() === value.toLowerCase(),
          );
          if (exact) {
            setSelectedSuggestion(exact);
          }
        }}
        onEditStart={() => setIsEditing(true)}
        onRemove={() => setContent([])}
        onSuggestionApplied={() => setSelectedSuggestion(null)}
        prefix="tech:"
        selectedSuggestion={selectedSuggestion}
      />

      <div className="mt-4 text-sm text-slate-500">
        <p>Current values: {content.join(", ")}</p>
        <p className="mt-2">
          Try typing: "react", "typescript", etc.
          <br />
          Add multiple values with commas.
        </p>
      </div>
    </div>
  );
};

export const AutocompleteDemo: Story = {
  render: () => <AutocompleteDemoComponent />,
};

export const WithLongContent: Story = {
  args: {
    color: "purple",
    content: ["react", "typescript", "tailwind", "storybook", "testing"],
    prefix: "tags:",
  },
  render: (args) => <EditableBadgeWithState {...args} />,
};
