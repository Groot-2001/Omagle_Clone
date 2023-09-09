exports.homeRouter = (req, res) => {
  res.render("index");
};

exports.videoRouter = (req, res) => {
  res.render("video_chat");
};

exports.chatRouter = (req, res) => {
  res.render("text_chat");
};
