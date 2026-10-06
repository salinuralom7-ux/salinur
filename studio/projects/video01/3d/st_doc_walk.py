import sys
sys.argv = [sys.argv[0], "doc_walk"] + sys.argv[1:]
exec(open("story.py").read())
