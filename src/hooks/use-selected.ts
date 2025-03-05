import { useCallback, useState } from "react";

export const useSelected = <P>(initialState: Array<P>) => {
  const [selected, setSelected] = useState<Set<P>>(new Set(initialState));

  const add = useCallback((items: Array<P>) => {
    setSelected((oldSet) => {
      const newSet = new Set(oldSet);
      items.forEach((item) => newSet.add(item));
      return newSet;
    });
  }, []);

  const remove = useCallback((items: Array<P>) => {
    setSelected((oldSet) => {
      const newSet = new Set(oldSet);
      items.forEach((item) => newSet.delete(item));
      return newSet;
    });
  }, []);

  const change = useCallback(
    (addOrRemove: boolean, items: Array<P>) => {
      if (addOrRemove) {
        add(items);
      } else {
        remove(items);
      }
    },
    [add, remove],
  );

  const clear = useCallback(() => setSelected(new Set()), []);

  // Convert the Set to an array when returning
  return {
    add,
    change,
    clear,
    remove,
    selected: Array.from(selected),
    selectedSet: selected,
  };
};
