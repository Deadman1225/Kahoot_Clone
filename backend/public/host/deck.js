const socket = io();
const slidesContainer = document.getElementById("slidesContainer");
const addSlideBtn = document.getElementById("addSlideBtn");
const saveBtn = document.getElementById("saveBtn");
const hostBtn = document.getElementById('hostBtn');

const quizTemplates = new Map();

let questionCount = 0;

addSlideBtn.addEventListener("click", createSlide);

saveBtn.addEventListener("click", async() => 
{
    await updateQuizData();
});

hostBtn.addEventListener("click", async()=>
{
    await updateQuizData();

    socket.emit('createPendingQuiz', [...quizTemplates],(response) =>
    {
        const roomPin = response.roomPin;
        window.location.href = `/host?pin=${roomPin}`;
    });
});

function createSlide() {

    questionCount++;

    const slide = document.createElement("div");

    slide.className = "question-slide";
    slide.dataset.id = questionCount;

    slide.innerHTML = `
        <h2>Question ${questionCount}</h2>

        <label>Question Text</label>
        <br>

        <input
            type="text"
            class="questionText"
            placeholder="Enter question"
        >

        <br><br>

        <label>Image</label>
        <br>

        <input
            type="file"
            class="questionImage"
            accept="image/*"
        >

        <br><br>

        <label>Options</label>
        <br>

        <input
            type="text"
            class="option"
            placeholder="Option 1"
        >
        <br>

        <input
            type="text"
            class="option"
            placeholder="Option 2"
        >
        <br>

        <input
            type="text"
            class="option"
            placeholder="Option 3"
        >
        <br>

        <input
            type="text"
            class="option"
            placeholder="Option 4"
        >

        <br><br>

        <label>Correct Answer</label>
        <br>

        <select class="correctAnswer">
            <option value="0">
                Option 1
            </option>

            <option value="1">
                Option 2
            </option>

            <option value="2">
                Option 3
            </option>

            <option value="3">
                Option 4
            </option>
        </select>

        <br><br>

        <label>Timer (seconds)</label>
        <br>

        <input
            type="number"
            class="timer"
            value="20"
            min="1"
        >

        <br><br>

        <button class="removeBtn">
            Delete Question
        </button>

        <hr>
    `;

    slidesContainer.appendChild(slide);

    quizTemplates.set(questionCount,
    {
        question:"",
        image:null,
        options:["","","",""],
        correctAnswer:0,
        timer:20
    });

    slide
    .querySelector(".removeBtn")
    .addEventListener("click",()=>
    {
        const id = Number(
            slide.dataset.id
        );

        quizTemplates.delete(id);

        slide.remove();

        updateQuestionNumbers();
    });
}

function updateQuestionNumbers() {

    const slides = document.querySelectorAll(".question-slide");
    const updatedMap = new Map();

    slides.forEach((slide,index)=>
    {
        const oldId = Number(slide.dataset.id);

        const newId = index + 1;

        slide.dataset.id = newId;

        slide
        .querySelector("h2")
        .innerText =
        `Question ${newId}`;

        if( quizTemplates.has(oldId))
        {
            updatedMap.set
            (
                newId,
                quizTemplates.get(oldId)
            );
        }

    });

    quizTemplates.clear();

    updatedMap.forEach(
        (value,key)=>{
            quizTemplates.set(
                key,
                value
            );
        }
    );

    questionCount =
        slides.length;
}

async function updateQuizData() {
    const slides = document.querySelectorAll(".question-slide");

    for (const slide of slides) {
        const id = Number(slide.dataset.id);
        const question = slide.querySelector(".questionText").value;
        const imageFileInput = slide.querySelector(".questionImage");
        const options = [...slide.querySelectorAll(".option")].map(option => option.value);
        const correctAnswer = Number(slide.querySelector(".correctAnswer").value);
        const timer = Number(slide.querySelector(".timer").value);

        let imageData = null;

        if (imageFileInput.files && imageFileInput.files[0]) {
            imageData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(imageFileInput.files[0]);
            });
        }

        quizTemplates.set(id, {
            question: question,
            image: imageData,
            options: options,
            correctAnswer: correctAnswer,
            timer: timer
        });
    }
}

createSlide();