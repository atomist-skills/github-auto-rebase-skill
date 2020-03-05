# `atomist/github-auto-rebase-skill`

<!---atomist-skill-readme:start--->

Any push to the base branch of a pull request branch will cause a rebase. For example, if open pull request branch `v2` has base branch `master`, and someone pushes a change to `master`, then `v2` will be rebased with the new commit(s) to `master`.

### **Enable auto-rebase**

To enable auto-rebasing, add this label to the pull request:

- `auto-rebase:on-push`

The label is automatically added to the repository when this skill is enabled.

## **Configuration**

### Which repositories

By default, this skill will be enabled for all repositories in all organizations you have connected.
To restrict the organizations or specific repositories on which the skill will run, you can explicitly
choose organization(s) and repositories.

<!---atomist-skill-readme:end--->

---
 
Created by [Atomist][atomist].
Need Help?  [Join our Slack workspace][slack].

[atomist]: https://atomist.com/ (Atomist - How Teams Deliver Software)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
 
