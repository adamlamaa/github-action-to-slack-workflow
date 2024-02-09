"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPayload = void 0;
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const node_fetch_1 = __importDefault(require("node-fetch"));
const actionColor = (status) => {
    if (status === "success")
        return "good";
    if (status === "failure")
        return "danger";
    if (status === "cancelled")
        return "danger";
    if (status === "skipped")
        return "#4a4a4a";
    return "warning";
};
const actionStatus = (status) => {
    if (status === "success")
        return "passed";
    if (status === "failure")
        return "failed";
    if (status === "cancelled")
        return "cancelled";
    if (status === "skipped")
        return "skipped";
    return "passed with warnings";
};
const actionEmoji = (status) => {
    if (status === "success")
        return (0, core_1.getInput)("icon_success");
    if (status === "failure")
        return (0, core_1.getInput)("icon_failure");
    if (status === "cancelled")
        return (0, core_1.getInput)("icon_cancelled");
    if (status === "skipped")
        return (0, core_1.getInput)("icon_skipped");
    return (0, core_1.getInput)("icon_warnings");
};
const makeMessage = (template, values) => {
    for (const k of Object.keys(values)) {
        template = template.replaceAll(`{${k}}`, values[k]);
    }
    return template;
};
const parseList = (value) => {
    return value
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
};
const parseStatusList = (value) => {
    return parseList(value);
};
const getMentionUsers = (status) => {
    const mentionUsers = (0, core_1.getInput)("mention_users");
    const mentionUsersWhen = (0, core_1.getInput)("mention_users_when");
    const users = parseList(mentionUsers);
    if (!users.length || !mentionUsersWhen.includes(status))
        return "";
    return users.map((x) => `<@${x}>`).join(" ");
};
const getMentionGroups = (status) => {
    const mentionGroups = (0, core_1.getInput)("mention_groups");
    const mentionGroupsWhen = (0, core_1.getInput)("mention_groups_when");
    const groups = parseList(mentionGroups);
    if (!groups.length || !mentionGroupsWhen.includes(status))
        return "";
    return groups
        .map((x) => {
        // useful for mentions like @channel
        // to mention a channel programmatically, we need to do <!channel>
        return x[0] === "!" ? `<${x}>` : `<!subteam^${x}>`;
    })
        .join(" ");
};
const getWorkflowUrl = (repo, name) => __awaiter(void 0, void 0, void 0, function* () {
    if (process.env.NODE_ENV === "test")
        return "test-workflow-url";
    const api = github_1.context.apiUrl;
    const token = (0, core_1.getInput)("token");
    const url = `${api}/repos/${repo}/actions/workflows`;
    const rep = yield (0, node_fetch_1.default)(url, {
        headers: {
            Accept: "application/vnd.github.v3+json",
            Authorization: `token ${token}`,
        },
    });
    if (rep.status === 200) {
        const data = yield rep.json();
        const workflows = data.workflows;
        for (const workflow of workflows) {
            if (workflow.name === name) {
                return workflow.html_url;
            }
        }
    }
    return "";
});
const buildPayload = () => __awaiter(void 0, void 0, void 0, function* () {
    const repo = `${github_1.context.repo.owner}/${github_1.context.repo.repo}`;
    const repoUrl = `${github_1.context.serverUrl}/${repo}`;
    const jobStatus = (0, core_1.getInput)("status");
    const patterns = {
        repo,
        branch: github_1.context.ref,
        commit_url: `${repoUrl}/commit/${github_1.context.sha}`,
        repo_url: `${repoUrl}`,
        run_url: `${repoUrl}/actions/runs/${github_1.context.runId}`,
        job: github_1.context.job,
        workflow: github_1.context.workflow,
        workflow_url: yield getWorkflowUrl(repo, github_1.context.workflow),
        color: actionColor(jobStatus),
        status_message: actionStatus(jobStatus),
        emoji: actionEmoji(jobStatus),
    };
    const title = makeMessage((0, core_1.getInput)("notification_title"), patterns);
    const message = makeMessage((0, core_1.getInput)("message_format"), patterns);
    const footer = makeMessage((0, core_1.getInput)("footer"), patterns);
    const text = [message, getMentionUsers(jobStatus), getMentionGroups(jobStatus)]
        .filter((x) => x.length > 0)
        .join("\n");
    const payload = {
        text: text,
        fallback: title,
        pretext: title,
        color: patterns["color"],
        mrkdwn_in: ["text"],
        footer: footer,
    };
    return JSON.stringify(payload);
});
exports.buildPayload = buildPayload;
const notifySlack = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl)
        throw new Error("No SLACK_WEBHOOK_URL provided");
    yield (0, node_fetch_1.default)(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
    });
});
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const notifyWhen = parseStatusList((0, core_1.getInput)("notify_when"));
        const jobStatus = (0, core_1.getInput)("status");
        if (!notifyWhen.includes(jobStatus))
            return;
        const payload = yield (0, exports.buildPayload)();
        yield notifySlack(payload);
    }
    catch (e) {
        if (e instanceof Error)
            (0, core_1.setFailed)(e.message);
    }
});
run();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsd0NBQW1EO0FBQ25ELDRDQUF5QztBQUN6Qyw0REFBOEI7QUFJOUIsTUFBTSxXQUFXLEdBQUcsQ0FBQyxNQUFpQixFQUFFLEVBQUU7SUFDeEMsSUFBSSxNQUFNLEtBQUssU0FBUztRQUFFLE9BQU8sTUFBTSxDQUFBO0lBQ3ZDLElBQUksTUFBTSxLQUFLLFNBQVM7UUFBRSxPQUFPLFFBQVEsQ0FBQTtJQUN6QyxJQUFJLE1BQU0sS0FBSyxXQUFXO1FBQUUsT0FBTyxRQUFRLENBQUE7SUFDM0MsSUFBSSxNQUFNLEtBQUssU0FBUztRQUFFLE9BQU8sU0FBUyxDQUFBO0lBQzFDLE9BQU8sU0FBUyxDQUFBO0FBQ2xCLENBQUMsQ0FBQTtBQUVELE1BQU0sWUFBWSxHQUFHLENBQUMsTUFBaUIsRUFBRSxFQUFFO0lBQ3pDLElBQUksTUFBTSxLQUFLLFNBQVM7UUFBRSxPQUFPLFFBQVEsQ0FBQTtJQUN6QyxJQUFJLE1BQU0sS0FBSyxTQUFTO1FBQUUsT0FBTyxRQUFRLENBQUE7SUFDekMsSUFBSSxNQUFNLEtBQUssV0FBVztRQUFFLE9BQU8sV0FBVyxDQUFBO0lBQzlDLElBQUksTUFBTSxLQUFLLFNBQVM7UUFBRSxPQUFPLFNBQVMsQ0FBQTtJQUMxQyxPQUFPLHNCQUFzQixDQUFBO0FBQy9CLENBQUMsQ0FBQTtBQUVELE1BQU0sV0FBVyxHQUFHLENBQUMsTUFBaUIsRUFBRSxFQUFFO0lBQ3hDLElBQUksTUFBTSxLQUFLLFNBQVM7UUFBRSxPQUFPLElBQUEsZUFBUSxFQUFDLGNBQWMsQ0FBQyxDQUFBO0lBQ3pELElBQUksTUFBTSxLQUFLLFNBQVM7UUFBRSxPQUFPLElBQUEsZUFBUSxFQUFDLGNBQWMsQ0FBQyxDQUFBO0lBQ3pELElBQUksTUFBTSxLQUFLLFdBQVc7UUFBRSxPQUFPLElBQUEsZUFBUSxFQUFDLGdCQUFnQixDQUFDLENBQUE7SUFDN0QsSUFBSSxNQUFNLEtBQUssU0FBUztRQUFFLE9BQU8sSUFBQSxlQUFRLEVBQUMsY0FBYyxDQUFDLENBQUE7SUFDekQsT0FBTyxJQUFBLGVBQVEsRUFBQyxlQUFlLENBQUMsQ0FBQTtBQUNsQyxDQUFDLENBQUE7QUFFRCxNQUFNLFdBQVcsR0FBRyxDQUFDLFFBQWdCLEVBQUUsTUFBOEIsRUFBRSxFQUFFO0lBQ3ZFLEtBQUssTUFBTSxDQUFDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtRQUNuQyxRQUFRLEdBQUcsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0tBQ3BEO0lBQ0QsT0FBTyxRQUFRLENBQUE7QUFDakIsQ0FBQyxDQUFBO0FBRUQsTUFBTSxTQUFTLEdBQUcsQ0FBQyxLQUFhLEVBQUUsRUFBRTtJQUNsQyxPQUFPLEtBQUs7U0FDVCxLQUFLLENBQUMsR0FBRyxDQUFDO1NBQ1YsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7U0FDcEIsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ2hDLENBQUMsQ0FBQTtBQUVELE1BQU0sZUFBZSxHQUFHLENBQUMsS0FBYSxFQUFFLEVBQUU7SUFDeEMsT0FBTyxTQUFTLENBQUMsS0FBSyxDQUFnQixDQUFBO0FBQ3hDLENBQUMsQ0FBQTtBQUVELE1BQU0sZUFBZSxHQUFHLENBQUMsTUFBaUIsRUFBRSxFQUFFO0lBQzVDLE1BQU0sWUFBWSxHQUFHLElBQUEsZUFBUSxFQUFDLGVBQWUsQ0FBQyxDQUFBO0lBQzlDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBQSxlQUFRLEVBQUMsb0JBQW9CLENBQUMsQ0FBQTtJQUV2RCxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUE7SUFDckMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO1FBQUUsT0FBTyxFQUFFLENBQUE7SUFDbEUsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQzlDLENBQUMsQ0FBQTtBQUVELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxNQUFpQixFQUFFLEVBQUU7SUFDN0MsTUFBTSxhQUFhLEdBQUcsSUFBQSxlQUFRLEVBQUMsZ0JBQWdCLENBQUMsQ0FBQTtJQUNoRCxNQUFNLGlCQUFpQixHQUFHLElBQUEsZUFBUSxFQUFDLHFCQUFxQixDQUFDLENBQUE7SUFFekQsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLGFBQWEsQ0FBQyxDQUFBO0lBQ3ZDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sRUFBRSxDQUFBO0lBRXBFLE9BQU8sTUFBTTtTQUNWLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO1FBQ1Qsb0NBQW9DO1FBQ3BDLGtFQUFrRTtRQUNsRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUE7SUFDcEQsQ0FBQyxDQUFDO1NBQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ2QsQ0FBQyxDQUFBO0FBRUQsTUFBTSxjQUFjLEdBQUcsQ0FBTyxJQUFZLEVBQUUsSUFBWSxFQUFFLEVBQUU7SUFDMUQsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsS0FBSyxNQUFNO1FBQUUsT0FBTyxtQkFBbUIsQ0FBQTtJQUUvRCxNQUFNLEdBQUcsR0FBRyxnQkFBTyxDQUFDLE1BQU0sQ0FBQTtJQUMxQixNQUFNLEtBQUssR0FBRyxJQUFBLGVBQVEsRUFBQyxPQUFPLENBQUMsQ0FBQTtJQUUvQixNQUFNLEdBQUcsR0FBRyxHQUFHLEdBQUcsVUFBVSxJQUFJLG9CQUFvQixDQUFBO0lBQ3BELE1BQU0sR0FBRyxHQUFHLE1BQU0sSUFBQSxvQkFBSyxFQUFDLEdBQUcsRUFBRTtRQUMzQixPQUFPLEVBQUU7WUFDUCxNQUFNLEVBQUUsZ0NBQWdDO1lBQ3hDLGFBQWEsRUFBRSxTQUFTLEtBQUssRUFBRTtTQUNoQztLQUNGLENBQUMsQ0FBQTtJQUVGLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxHQUFHLEVBQUU7UUFDdEIsTUFBTSxJQUFJLEdBQUcsTUFBTSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUE7UUFDN0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQTtRQUNoQyxLQUFLLE1BQU0sUUFBUSxJQUFJLFNBQVMsRUFBRTtZQUNoQyxJQUFJLFFBQVEsQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO2dCQUMxQixPQUFPLFFBQVEsQ0FBQyxRQUFRLENBQUE7YUFDekI7U0FDRjtLQUNGO0lBRUQsT0FBTyxFQUFFLENBQUE7QUFDWCxDQUFDLENBQUEsQ0FBQTtBQUVNLE1BQU0sWUFBWSxHQUFHLEdBQVMsRUFBRTtJQUNyQyxNQUFNLElBQUksR0FBRyxHQUFHLGdCQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxnQkFBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQTtJQUN6RCxNQUFNLE9BQU8sR0FBRyxHQUFHLGdCQUFPLENBQUMsU0FBUyxJQUFJLElBQUksRUFBRSxDQUFBO0lBQzlDLE1BQU0sU0FBUyxHQUFHLElBQUEsZUFBUSxFQUFDLFFBQVEsQ0FBYyxDQUFBO0lBRWpELE1BQU0sUUFBUSxHQUEyQjtRQUN2QyxJQUFJO1FBQ0osTUFBTSxFQUFFLGdCQUFPLENBQUMsR0FBRztRQUNuQixVQUFVLEVBQUUsR0FBRyxPQUFPLFdBQVcsZ0JBQU8sQ0FBQyxHQUFHLEVBQUU7UUFDOUMsUUFBUSxFQUFFLEdBQUcsT0FBTyxFQUFFO1FBQ3RCLE9BQU8sRUFBRSxHQUFHLE9BQU8saUJBQWlCLGdCQUFPLENBQUMsS0FBSyxFQUFFO1FBQ25ELEdBQUcsRUFBRSxnQkFBTyxDQUFDLEdBQUc7UUFDaEIsUUFBUSxFQUFFLGdCQUFPLENBQUMsUUFBUTtRQUMxQixZQUFZLEVBQUUsTUFBTSxjQUFjLENBQUMsSUFBSSxFQUFFLGdCQUFPLENBQUMsUUFBUSxDQUFDO1FBQzFELEtBQUssRUFBRSxXQUFXLENBQUMsU0FBUyxDQUFDO1FBQzdCLGNBQWMsRUFBRSxZQUFZLENBQUMsU0FBUyxDQUFDO1FBQ3ZDLEtBQUssRUFBRSxXQUFXLENBQUMsU0FBUyxDQUFDO0tBQzlCLENBQUE7SUFFRCxNQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsSUFBQSxlQUFRLEVBQUMsb0JBQW9CLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQTtJQUNuRSxNQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsSUFBQSxlQUFRLEVBQUMsZ0JBQWdCLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQTtJQUNqRSxNQUFNLE1BQU0sR0FBRyxXQUFXLENBQUMsSUFBQSxlQUFRLEVBQUMsUUFBUSxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUE7SUFFeEQsTUFBTSxJQUFJLEdBQUcsQ0FBQyxPQUFPLEVBQUUsZUFBZSxDQUFDLFNBQVMsQ0FBQyxFQUFFLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQzVFLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7U0FDM0IsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBO0lBRWIsTUFBTSxPQUFPLEdBQUc7UUFDZCxJQUFJLEVBQUUsSUFBSTtRQUNWLFFBQVEsRUFBRSxLQUFLO1FBQ2YsT0FBTyxFQUFFLEtBQUs7UUFDZCxLQUFLLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQztRQUN4QixTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDbkIsTUFBTSxFQUFFLE1BQU07S0FDZixDQUFBO0lBRUQsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFBO0FBQ2hDLENBQUMsQ0FBQSxDQUFBO0FBckNZLFFBQUEsWUFBWSxnQkFxQ3hCO0FBRUQsTUFBTSxXQUFXLEdBQUcsQ0FBTyxPQUFlLEVBQUUsRUFBRTtJQUM1QyxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFBO0lBQ2hELElBQUksQ0FBQyxVQUFVO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFBO0lBRWpFLE1BQU0sSUFBQSxvQkFBSyxFQUFDLFVBQVUsRUFBRTtRQUN0QixNQUFNLEVBQUUsTUFBTTtRQUNkLE9BQU8sRUFBRSxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRTtRQUMvQyxJQUFJLEVBQUUsT0FBTztLQUNkLENBQUMsQ0FBQTtBQUNKLENBQUMsQ0FBQSxDQUFBO0FBRUQsTUFBTSxHQUFHLEdBQUcsR0FBUyxFQUFFO0lBQ3JCLElBQUk7UUFDRixNQUFNLFVBQVUsR0FBRyxlQUFlLENBQUMsSUFBQSxlQUFRLEVBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQTtRQUMzRCxNQUFNLFNBQVMsR0FBRyxJQUFBLGVBQVEsRUFBQyxRQUFRLENBQWMsQ0FBQTtRQUNqRCxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxPQUFNO1FBRTNDLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBQSxvQkFBWSxHQUFFLENBQUE7UUFDcEMsTUFBTSxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUE7S0FDM0I7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNWLElBQUksQ0FBQyxZQUFZLEtBQUs7WUFBRSxJQUFBLGdCQUFTLEVBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFBO0tBQzdDO0FBQ0gsQ0FBQyxDQUFBLENBQUE7QUFFRCxHQUFHLEVBQUUsQ0FBQSJ9