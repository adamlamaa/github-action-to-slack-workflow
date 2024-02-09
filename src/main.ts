import { getInput, setFailed } from "@actions/core"
import { context } from "@actions/github"
import fetch from "node-fetch"

type JobStatus = "success" | "failure" | "cancelled" | "warning" | "skipped"

const actionColor = (status: JobStatus) => {
  if (status === "success") return "good"
  if (status === "failure") return "danger"
  if (status === "cancelled") return "danger"
  if (status === "skipped") return "#4a4a4a"
  return "warning"
}

const actionStatus = (status: JobStatus) => {
  if (status === "success") return "passed"
  if (status === "failure") return "failed"
  if (status === "cancelled") return "cancelled"
  if (status === "skipped") return "skipped"
  return "passed with warnings"
}

const actionEmoji = (status: JobStatus) => {
  if (status === "success") return getInput("icon_success")
  if (status === "failure") return getInput("icon_failure")
  if (status === "cancelled") return getInput("icon_cancelled")
  if (status === "skipped") return getInput("icon_skipped")
  return getInput("icon_warnings")
}

const makeMessage = (template: string, values: Record<string, string>) => {
  for (const k of Object.keys(values)) {
    template = template.replaceAll(`{${k}}`, values[k])
  }
  return template
}

const parseList = (value: string) => {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
}

const parseStatusList = (value: string) => {
  return parseList(value) as JobStatus[]
}

const getMentionUsers = (status: JobStatus) => {
  const mentionUsers = getInput("mention_users")
  const mentionUsersWhen = getInput("mention_users_when")

  const users = parseList(mentionUsers)
  if (!users.length || !mentionUsersWhen.includes(status)) return ""
  return users.map((x) => `<@${x}>`).join(" ")
}

const getMentionGroups = (status: JobStatus) => {
  const mentionGroups = getInput("mention_groups")
  const mentionGroupsWhen = getInput("mention_groups_when")

  const groups = parseList(mentionGroups)
  if (!groups.length || !mentionGroupsWhen.includes(status)) return ""

  return groups
    .map((x) => {
      // useful for mentions like @channel
      // to mention a channel programmatically, we need to do <!channel>
      return x[0] === "!" ? `<${x}>` : `<!subteam^${x}>`
    })
    .join(" ")
}

const getWorkflowUrl = async (repo: string, name: string) => {
  if (process.env.NODE_ENV === "test") return "test-workflow-url"

  const api = context.apiUrl
  const token = getInput("token")

  const url = `${api}/repos/${repo}/actions/workflows`
  const rep = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `token ${token}`,
    },
  })

  if (rep.status === 200) {
    const data = await rep.json()
    const workflows = data.workflows
    for (const workflow of workflows) {
      if (workflow.name === name) {
        return workflow.html_url
      }
    }
  }

  return ""
}

export const buildPayload = async () => {
  console.info("Building payload")
  const repo = `${context.repo.owner}/${context.repo.repo}`
  const repoUrl = `${context.serverUrl}/${repo}`
  const jobStatus = getInput("status") as JobStatus
  console.info(`Job status: ${jobStatus}`)

  const patterns: Record<string, string> = {
    repo,
    branch: context.ref,
    branch_url: `${repoUrl}/tree/${context.ref.replace("refs/heads/", "")}`,
    commit_sha: context.sha.substring(0, 7),
    commit_url: `${repoUrl}/commit/${context.sha}`,
    repo_url: `${repoUrl}`,
    run_url: `${repoUrl}/actions/runs/${context.runId}`,
    job: context.job,
    workflow: context.workflow,
    workflow_url: await getWorkflowUrl(repo, context.workflow),
    color: actionColor(jobStatus),
    status_message: actionStatus(jobStatus),
    emoji: actionEmoji(jobStatus),
  }

  const title = makeMessage(getInput("notification_title"), patterns)
  const message = makeMessage(getInput("message_format"), patterns)
  const footer = makeMessage(getInput("footer"), patterns)

  console.info(`Title: ${title}`)
  console.info(`Message: ${message}`)
  console.info(`Footer: ${footer}`)

  const text = [message, getMentionUsers(jobStatus), getMentionGroups(jobStatus)]
    .filter((x) => x.length > 0)
    .join("\n")

  const payload = {
    text: text,
    fallback: title,
    pretext: title,
    color: patterns["color"],
    mrkdwn_in: ["text"],
    footer: footer,
  }

  return JSON.stringify(payload)
}

const notifySlack = async (payload: string) => {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) throw new Error("No SLACK_WEBHOOK_URL provided")

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  })
}

const run = async () => {
  try {
    const notifyWhen = parseStatusList(getInput("notify_when"))
    const jobStatus = getInput("status") as JobStatus
    if (!notifyWhen.includes(jobStatus)) return

    const payload = await buildPayload()
    console.info("Sending payload to Slack", payload)
    await notifySlack(payload)
  } catch (e) {
    if (e instanceof Error) setFailed(e.message)
  }
}

run()
