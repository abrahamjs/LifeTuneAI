let goalsChart;

document.addEventListener("DOMContentLoaded", function () {
  loadGoals();

  // Handle goal title and description changes to suggest tasks
  document
    .getElementById("goalTitle")
    .addEventListener("blur", async function () {
      const title = this.value;
      const description = document.getElementById("goalDescription").value;
      if (title) {
        await suggestTasks(title, description);
      }
    });

  document
    .getElementById("goalDescription")
    .addEventListener("blur", async function () {
      const title = document.getElementById("goalTitle").value;
      const description = this.value;
      if (title && description) {
        await suggestTasks(title, description);
      }
    });

  // Handle generate more tasks button
  document
    .getElementById("generateMoreTasks")
    ?.addEventListener("click", async function () {
      const title = document.getElementById("goalTitle").value;
      const description = document.getElementById("goalDescription").value;
      if (title) {
        await suggestTasks(title, description);
      }
    });

  // Handle new goal form submission
  document
    .getElementById("saveGoal")
    .addEventListener("click", async function () {
      // Clear previous error messages
      const errorContainer = document.getElementById("goalFormErrors") || 
        (() => {
          const div = document.createElement("div");
          div.id = "goalFormErrors";
          div.className = "alert alert-danger d-none";
          document.getElementById("newGoalForm").prepend(div);
          return div;
        })();

      const title = document.getElementById("goalTitle").value;
      const description = document.getElementById("goalDescription").value;
      const category = document.getElementById("goalCategory").value;
      const target_date = document.getElementById("goalTargetDate").value;

      // Basic validation
      if (!title || !target_date) {
        errorContainer.textContent = "Please fill in all required fields";
        errorContainer.classList.remove("d-none");
        return;
      }

      // Get selected tasks with proper error handling
      const selectedTasks = Array.from(
        document.querySelectorAll(
          '#taskSuggestionsList input[type="checkbox"]:checked'
        )
      ).map((checkbox) => {
        const taskElement = checkbox.closest(".task-suggestion-item");
        return {
          title: taskElement.querySelector(".fw-bold").textContent.trim(),
          description: taskElement.querySelector("small")?.textContent?.trim() || "",
          priority: taskElement.dataset.priority || "normal"
        };
      });

      try {
        const response = await fetch("/api/goals", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            description,
            category,
            target_date,
            tasks: selectedTasks,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          const modal = bootstrap.Modal.getInstance(
            document.getElementById("newGoalModal")
          );
          modal.hide();
          loadGoals();
          // Clear form
          document.getElementById("newGoalForm").reset();
          errorContainer.classList.add("d-none");
        } else {
          // Show error message
          errorContainer.textContent = data.message || "Failed to create goal";
          errorContainer.classList.remove("d-none");
        }
      } catch (error) {
        console.error("Error saving goal:", error);
        errorContainer.textContent = "An error occurred while saving the goal";
        errorContainer.classList.remove("d-none");
      }
    });
});
function loadGoals() {
  fetch("/api/goals")
    .then((response) => response.json())
    .then((goals) => {
      const goalsList = document.getElementById("goalsList");
      goalsList.innerHTML = goals
        .map(
          (goal) => `
                <div class="goal-card" onclick="showGoalDetails(${goal.id})">
                    <div class="goal-card-content">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="card-title mb-0">${goal.title}</h6>
                            <span class="badge bg-${getCategoryBadgeClass(
                              goal.category
                            )}">${goal.category}</span>
                        </div>
                        <div class="progress">
                            <div class="progress-bar" role="progressbar" 
                                 style="width: ${goal.progress}%" 
                                 aria-valuenow="${goal.progress}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                                ${goal.progress}%
                            </div>
                        </div>
                    </div>
                </div>
            `
        )
        .join("");
    });
}

function showGoalDetails(goalId) {
  fetch(`/api/goals/${goalId}`)
    .then((response) => response.json())
    .then((goal) => {
      const detailsContent = document.getElementById("goalDetailsContent");
      detailsContent.innerHTML = `
                <div class="goal-details">
                    <div class="goal-header mb-4">
                        <h4>${goal.title}</h4>
                        <span class="badge bg-${getCategoryBadgeClass(
                          goal.category
                        )} mb-2">${goal.category}</span>
                        <p class="text-muted">${goal.description}</p>
                    </div>
                    <div class="goal-dates mb-4">
                        <div class="row">
                            <div class="col-6">
                                <small class="text-muted">Created</small>
                                <div>${new Date(
                                  goal.created_at
                                ).toLocaleDateString()}</div>
                            </div>
                            <div class="col-6">
                                <small class="text-muted">Target Date</small>
                                <div>${new Date(
                                  goal.target_date
                                ).toLocaleDateString()}</div>
                            </div>
                        </div>
                    </div>
                    <div class="goal-progress mb-4">
                        <h6>Progress</h6>
                        <div class="progress">
                            <div class="progress-bar" role="progressbar" 
                                 style="width: ${goal.progress}%" 
                                 aria-valuenow="${goal.progress}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                                ${goal.progress}%
                            </div>
                        </div>
                    </div>
                    <div class="goal-tasks">
                        <h6>Related Tasks</h6>
                        <div class="list-group">
                            ${goal.tasks
                              .map(
                                (task) => `
                                <div class="list-group-item">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div class="flex-grow-1" onclick="showTaskDetails(${task.id}, event)" style="cursor: pointer;">
                                            <div class="fw-bold">${task.title}</div>
                                            <small class="text-muted">${task.description || ""}</small>
                                        </div>
                                        <div class="d-flex align-items-center">
                                            <input type="checkbox" class="form-check-input me-2" 
                                                   ${task.completed ? 'checked' : ''} 
                                                   onclick="toggleTaskCompletion(${task.id}, event)">
                                            <span class="badge bg-${getPriorityBadgeClass(task.priority)}">${task.priority}</span>
                                        </div>
                                    </div>
                                </div>
                            `
                              )
                              .join("")}
                        </div>
                    </div>
                </div>
            `;

      // Setup delete handler
      document.getElementById("deleteGoal").onclick = () => deleteGoal(goal.id);
      // Setup edit handler
      document.getElementById("editGoal").onclick = () => editGoal(goal.id);

      // Show the modal
      const modal = new bootstrap.Modal(
        document.getElementById("goalDetailsModal")
      );
      modal.show();
    });
}

function deleteGoal(goalId) {
  if (confirm("Are you sure you want to delete this goal?")) {
    fetch(`/api/goals/${goalId}`, {
      method: "DELETE",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "success") {
          const modal = bootstrap.Modal.getInstance(
            document.getElementById("goalDetailsModal")
          );
          modal.hide();
          loadGoals();
        }
      });
  }
}

function editGoal(goalId) {
  // Hide details modal
  const detailsModal = bootstrap.Modal.getInstance(
    document.getElementById("goalDetailsModal")
  );
  detailsModal.hide();

  // Show edit modal
  const editModal = new bootstrap.Modal(
    document.getElementById("newGoalModal")
  );
  editModal.show();

  // Populate form with goal data
  fetch(`/api/goals/${goalId}`)
    .then((response) => response.json())
    .then((goal) => {
      document.getElementById("goalTitle").value = goal.title;
      document.getElementById("goalDescription").value = goal.description;
      document.getElementById("goalCategory").value = goal.category;
      document.getElementById("goalTargetDate").value =
        goal.target_date.split("T")[0];

      // Update save button to handle edit
      const saveButton = document.getElementById("saveGoal");
      saveButton.textContent = "Update Goal";
      saveButton.onclick = () => updateGoal(goalId);
    });
}

function updateGoal(goalId) {
  const data = {
    title: document.getElementById("goalTitle").value,
    description: document.getElementById("goalDescription").value,
    category: document.getElementById("goalCategory").value,
    target_date: document.getElementById("goalTargetDate").value,
  };

  fetch(`/api/goals/${goalId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.status === "success") {
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("newGoalModal")
        );
        modal.hide();
        loadGoals();

        // Reset the save button
        const saveButton = document.getElementById("saveGoal");
        saveButton.textContent = "Create Goal";
        saveButton.onclick = null; // Reset to default handler
      }
    });
}

function getCategoryBadgeClass(category) {
  switch (category.toLowerCase()) {
    case "personal":
      return "info";
    case "professional":
      return "primary";
    case "health":
      return "success";
    case "education":
      return "warning";
    default:
      return "secondary";
  }
}

function getPriorityBadgeClass(priority) {
  switch (priority.toLowerCase()) {
    case "urgent":
      return "danger";
    case "important":
      return "warning";
    default:
      return "secondary";
  }
}

async function suggestTasks(title, description) {
  try {
    const target_date = document.getElementById("goalTargetDate").value;
    const response = await fetch("/api/goals/suggest-tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        title, 
        description,
        target_date,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const suggestedTasks = document.getElementById("suggestedTasks");
    const tasksList = document.getElementById("taskSuggestionsList");

    if (!Array.isArray(data) || data.length === 0) {
      tasksList.innerHTML = `
        <div class="alert alert-warning">
          No task suggestions available. Try adding more details to your goal.
        </div>
      `;
      suggestedTasks.classList.remove("d-none");
      return;
    }

    // Sort tasks by priority and timeline
    const sortedTasks = data.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, normal: 4 };
      return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
    });

    tasksList.innerHTML = sortedTasks
      .map(
        (task) => `
          <div class="list-group-item task-suggestion-item" data-priority="${task.priority || 'normal'}">
            <div class="form-check d-flex align-items-center">
              <input 
                class="form-check-input me-2" 
                type="checkbox" 
                value="" 
                id="task_${btoa(task.title)}"
              >
              <label class="form-check-label flex-grow-1" for="task_${btoa(task.title)}">
                <div class="d-flex justify-content-between align-items-center">
                  <div class="fw-bold">${task.title}</div>
                  <span class="badge bg-${getPriorityBadgeClass(task.priority || 'normal')}">${task.priority || 'normal'}</span>
                </div>
                <small class="text-muted d-block">${task.description}</small>
              </label>
            </div>
          </div>
        `
      )
      .join("");

    suggestedTasks.classList.remove("d-none");
  } catch (error) {
    console.error("Error getting task suggestions:", error);
    const errorMessage = error.message || "An error occurred while generating tasks. Please try again.";
    document.getElementById("taskSuggestionsList").innerHTML = `
      <div class="alert alert-danger">
        ${errorMessage}
      </div>
    `;
  }
}
