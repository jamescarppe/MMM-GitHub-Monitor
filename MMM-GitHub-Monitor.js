Module.register('MMM-GitHub-Monitor', {
  defaults: {
    updateInterval: 1000 * 60 * 10,
    renderInterval: 1000 * 5,
    maxPullRequestTitleLength: 100,
    maxIssueTitleLength: 100,
    repositories: [
      {
        owner: 'fpfuetsch',
        name: 'MMM-GitHub-Monitor',
        pulls: {
          display: true,
          loadCount: 10,
          displayCount: 2,
          state: 'open',
          head: '',
          base: 'main',
          sort: 'created',
          direction: 'desc',
        },
        issues: {
          display: true,
          loadCount: 10,
          displayCount: 2,
          state: 'open',
          sort: 'created',
          direction: 'desc',
        }
      },
    ],
    sort: true,
  },

  getStyles: function () {
    return [
      this.file('MMM-GitHub-Monitor.css'),
      'font-awesome.css'
    ];
  },

  start: function () {
    Log.log('Starting module: ' + this.name);
    this.initState();
    this.updateCycle();
    setInterval(this.updateCycle, this.config.updateInterval);
    setInterval(() => this.updateDom(), this.config.renderInterval);
  },

  initState: function () {
    this.state = [];
    for (let id = 0; id < this.config.repositories.length; id++) {
      this.state[id] = 0;
    }
  },

  updateCycle: async function () {
    this.ghData = [];
    await this.updateData();
    this.updateDom();
  },

  updateData: async function () {
    for (let id = 0; id < this.config.repositories.length; id++) {
      const repo = this.config.repositories[id];
      const resBase = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`)
      if (resBase.ok) {
        const jsonBase = await resBase.json();
        const repoData = {
          id: id,
          title: `${repo.owner}/${repo.name}`,
          stars: jsonBase.stargazers_count,
          forks: jsonBase.forks_count,
        }

        if (repo.pulls && repo.pulls.display) {
          const pullsConfig = {
            state: repo.pulls.state || 'open',
            head: repo.pulls.head,
            base: repo.pulls.base,
            sort: repo.pulls.sort || 'created',
            direction: repo.pulls.direction || 'desc',
          }
          let params = [];
          Object.keys(pullsConfig).forEach(key => {
            if (pullsConfig[key]) {
              params.push(`${key}=${pullsConfig[key]}`)
            }
          });
          const resPulls = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/pulls?${params.join('&')}`)
          if (resPulls.ok) {
            let jsonPulls = await resPulls.json();
            if (repo.pulls.loadCount) {
              jsonPulls = jsonPulls.slice(0, repo.pulls.loadCount);
            }
            if (this.config.maxPullRequestTitleLength) {
              jsonPulls.forEach(pull => {
                if (pull.title.length > this.config.maxPullRequestTitleLength) {
                  pull.title = pull.title.substr(0, this.config.maxPullRequestTitleLength) + '...';
                }
              })
            }
            repoData.step = Math.min(repo.pulls.displayCount, jsonPulls.length);
            repoData.pulls = jsonPulls;
          }
        }

        if (repo.issues && repo.issues.display) {
          const issuesConfig = {
            state: repo.issues.state || 'open',
            sort: repo.issues.sort || 'created',
            direction: repo.issues.direction || 'desc',
          }
          let params = [];
          Object.keys(issuesConfig).forEach(key => {
            if (issuesConfig[key]) {
              params.push(`${key}=${issuesConfig[key]}`)
            }
          });
          const resIssues = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/issues?${params.join('&')}`)
          if (resIssues.ok) {
            let jsonIssues = await resIssues.json();
            for (var i = jsonIssues.length - 1; i >= 0; i--) {
              if (jsonIssues[i].hasOwnProperty('pull_request')) {
                jsonIssues.splice(i, 1);
              }
            }
            if (repo.issues.loadCount) {
              jsonIssues = jsonIssues.slice(0, repo.issues.loadCount);
            }
            if (this.config.maxIssueTitleLength) {
              jsonIssues.forEach(issue => {
                if (issue.title.length > this.config.maxIssueTitleLength) {
                  issue.title = issue.title.substr(0, this.config.maxIssueTitleLength) + '...';
                }
              })
            }
            repoData.step = Math.min(repo.issues.displayCount, jsonIssues.length);
            repoData.issues = jsonIssues;
          }
        }        
        this.ghData.push(repoData)
      }
    }
    if (this.config.sort) {
      this.ghData.sort((r1, r2) => r1.title.localeCompare(r2.title));
    }
  },

  getDom: function () {
    let table = document.createElement('table');
    table.classList.add('gh-monitor');

    this.ghData.forEach((repo) => {
      let basicRow = document.createElement('tr');
      basicRow.style.fontWeight = 'bold';
      basicRow.style.paddingBottom = '0.5em';

      let title = document.createElement('td');
      title.innerText = repo.title;

      let stars = document.createElement('td');
      stars.innerHTML = `<i class="fa fa-star"></i> ${repo.stars}`;
      stars.style.textAlign = 'left';

      let forks = document.createElement('td');
      forks.innerHTML = `<i class="fa fa-code-fork"></i> ${repo.forks}`;
      forks.style.textAlign = 'left';

      basicRow.append(title);
      basicRow.append(stars);
      basicRow.append(forks)
      table.append(basicRow);

      if (repo.pulls) {
        const displayedPulls = [];
        for (let i = 0; i < repo.step; i++) {
          if (this.state[repo.id] + 1 < repo.pulls.length) {
            displayedPulls.push(repo.pulls[this.state[repo.id] + 1])
            this.state[repo.id]++;
          } else {
            displayedPulls.push(repo.pulls[0])
            this.state[repo.id] = 0;
          }
        }
        displayedPulls.forEach(pull => {
          const pullRow = document.createElement('tr');
          const pullEntry = document.createElement('td');
          pullEntry.style.paddingLeft = '1em';
          pullEntry.colSpan = 3;
          pullEntry.innerText = `#${pull.number} ${pull.title}`;
          pullRow.append(pullEntry);
          table.append(pullRow);
        });
      }
      if (repo.issues) {
        const displayedIssues = [];
        for (let i = 0; i < repo.step; i++) {
          if (this.state[repo.id] + 1 < repo.issues.length) {
            displayedIssues.push(repo.issues[this.state[repo.id] + 1])
            this.state[repo.id]++;
          } else {
            displayedIssues.push(repo.issues[0])
            this.state[repo.id] = 0;
          }
        }
        displayedIssues.forEach(issue => {
          const issueRow = document.createElement('tr');
          const issueEntry = document.createElement('td');
          issueEntry.style.paddingLeft = '1em';
          issueEntry.colSpan = 3;
          issueEntry.innerText = `#${issue.number} ${issue.title}`;
          issueRow.append(issueEntry);
          table.append(issueRow);
        });
      }
    })
    return table;
  }
});
