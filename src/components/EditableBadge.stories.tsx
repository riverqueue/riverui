import type { Meta, StoryObj } from "@storybook/react";

import { useState } from "react";

import { BadgeColors } from "./Badge";
import { EditableBadge, EditableValue } from "./EditableBadge";

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

  const handleContentChange = (editableValue: EditableValue) => {
    setContent(editableValue.values);
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

  const handleContentChange = (id: string, newContent: EditableValue) => {
    if (newContent.editingIndex === -1 || newContent.editingValue === "") {
      setBadges((prev) =>
        prev.map((badge) =>
          badge.id === id ? { ...badge, content: newContent.values } : badge,
        ),
      );
    }
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
              onContentChange={(newContent) =>
                handleContentChange(badge.id, newContent)
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

export const WithLongContent: Story = {
  args: {
    color: "purple",
    content: ["react", "typescript", "tailwind", "storybook", "testing"],
    prefix: "tags:",
  },
  render: (args) => <EditableBadgeWithState {...args} />,
};
