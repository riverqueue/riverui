import { retryJobs } from "@services/jobs";
import { toastError, toastSuccess } from "@services/toast";
import { useMutation } from "@tanstack/react-query";

type UseRetryJobsOptions = {
  onSuccess: () => unknown;
  successMessage: string;
};

export const useRetryJobs = ({
  onSuccess,
  successMessage,
}: UseRetryJobsOptions) =>
  useMutation<void, Error, bigint[]>({
    mutationFn: async (jobIDs, context) => retryJobs({ ids: jobIDs }, context),
    onError: (error) => {
      toastError({
        message: "Job retry failed",
        subtext: error.message,
      });
    },
    onSuccess: () => {
      toastSuccess({
        duration: 2000,
        message: successMessage,
      });
      return onSuccess();
    },
    throwOnError: false,
  });
